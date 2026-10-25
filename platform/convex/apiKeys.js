import { getAuthUserId } from '@convex-dev/auth/server'
import { action, internalMutation, mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { ConvexError, v } from 'convex/values'
import { sha256Hex } from './lib/crypto'
import { CAN, requireMember } from './lib/orgs'

const SCOPES = ['Read datasets', 'Read only', 'Full access']

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { org } = await requireMember(ctx)
    const keys = await ctx.db
      .query('apiKeys')
      .withIndex('by_org', (q) => q.eq('orgId', org._id))
      .order('desc')
      .collect()
    return keys.map((k) => ({
      id: k._id,
      name: k.name,
      prefix: k.prefix,
      scope: k.scope,
      created: new Date(k._creationTime).toISOString().slice(0, 10),
      lastUsedAt: k.lastUsedAt ?? null,
    }))
  },
})

/** Creates a key and returns its secret. This is the only time the secret is available. */
export const create = action({
  args: { name: v.string(), scope: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) throw new ConvexError('Not signed in')
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    const secret = `cpb_live_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
    await ctx.runMutation(internal.apiKeys.insert, {
      name: args.name.trim() || 'Untitled key',
      scope: SCOPES.includes(args.scope) ? args.scope : 'Read datasets',
      prefix: `cpb_live_••••••••••••${secret.slice(-4)}`,
      hash: await sha256Hex(secret),
    })
    return { secret }
  },
})

// Auth context carries over from the calling action, so the role check runs here.
export const insert = internalMutation({
  args: { name: v.string(), scope: v.string(), prefix: v.string(), hash: v.string() },
  handler: async (ctx, args) => {
    const { org, userId } = await requireMember(ctx, CAN.manageKeys)
    await ctx.db.insert('apiKeys', { ...args, orgId: org._id, createdBy: userId })
  },
})

export const revoke = mutation({
  args: { keyId: v.id('apiKeys') },
  handler: async (ctx, { keyId }) => {
    const { org } = await requireMember(ctx, CAN.manageKeys)
    const key = await ctx.db.get(keyId)
    if (!key || key.orgId !== org._id) throw new ConvexError('Key not found')
    await ctx.db.delete(keyId)
  },
})
