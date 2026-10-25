import { getAuthUserId } from '@convex-dev/auth/server'
import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { CAN, requireMember } from './lib/orgs'

function initials(name) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : parts[0]?.[1] ?? '')).toUpperCase()
}

/** The signed-in user, their organization and what their role allows. Null when signed out. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const user = await ctx.db.get(userId)
    const member = await ctx.db
      .query('members')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first()
    if (!user || !member) return null
    const org = await ctx.db.get(member.orgId)
    const name = user.name ?? member.name
    return {
      user: { id: userId, name, email: user.email, initials: initials(name), role: member.role },
      organization: {
        id: org.publicId,
        name: org.name,
        slug: org.slug,
        website: org.website,
        contact: org.contact,
        plan: org.plan,
        balance: org.balance,
        createdAt: new Date(org._creationTime).toISOString().slice(0, 10),
        retention: org.retention,
      },
      can: Object.fromEntries(Object.entries(CAN).map(([k, roles]) => [k, roles.includes(member.role)])),
    }
  },
})

export const updateOrganization = mutation({
  args: { name: v.string(), website: v.string(), contact: v.string() },
  handler: async (ctx, args) => {
    const { org } = await requireMember(ctx, CAN.manageOrg)
    const name = args.name.trim()
    if (!name) throw new ConvexError('Organization name is required')
    await ctx.db.patch(org._id, { ...args, name })
  },
})

export const updateRetention = mutation({
  args: {
    raw: v.string(),
    rejected: v.string(),
    derived: v.string(),
    autoDelete: v.boolean(),
  },
  handler: async (ctx, retention) => {
    const { org } = await requireMember(ctx, CAN.manageOrg)
    await ctx.db.patch(org._id, { retention })
  },
})

/** Called once per app load to keep "Last active" in the team table current. */
export const touch = mutation({
  args: {},
  handler: async (ctx) => {
    const { member } = await requireMember(ctx)
    await ctx.db.patch(member._id, { lastActiveAt: Date.now() })
  },
})

export const updateProfile = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const { userId, member } = await requireMember(ctx)
    const clean = name.trim()
    if (!clean) throw new ConvexError('Name is required')
    await ctx.db.patch(userId, { name: clean })
    await ctx.db.patch(member._id, { name: clean })
  },
})
