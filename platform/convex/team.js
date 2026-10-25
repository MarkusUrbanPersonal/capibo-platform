import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { roles } from './schema'
import { CAN, requireMember } from './lib/orgs'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { org, userId } = await requireMember(ctx)
    const rows = await ctx.db
      .query('members')
      .withIndex('by_org', (q) => q.eq('orgId', org._id))
      .collect()
    return rows.map((m) => ({
      id: m._id,
      name: m.name,
      email: m.email,
      role: m.role,
      pending: m.pending,
      lastActiveAt: m.lastActiveAt ?? null,
      isYou: m.userId === userId,
    }))
  },
})

/** Records an invite. The person joins this organization when they sign up with that email. */
export const invite = mutation({
  args: { email: v.string(), role: roles },
  handler: async (ctx, args) => {
    const { org } = await requireMember(ctx, CAN.manageTeam)
    const email = args.email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ConvexError('Enter a valid email address')
    if (args.role === 'Owner') throw new ConvexError('Each organization has a single owner')
    const existing = await ctx.db
      .query('members')
      .withIndex('by_email', (q) => q.eq('email', email))
      .collect()
    if (existing.some((m) => m.orgId === org._id)) throw new ConvexError(`${email} is already on this team`)
    const account = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', email))
      .first()
    if (account) throw new ConvexError(`${email} already has a Capibo account in another organization`)
    const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    await ctx.db.insert('members', { orgId: org._id, email, name, role: args.role, pending: true })
  },
})

async function teammate(ctx, memberId) {
  const { org, member: me } = await requireMember(ctx, CAN.manageTeam)
  const target = await ctx.db.get(memberId)
  if (!target || target.orgId !== org._id) throw new ConvexError('Member not found')
  if (target.role === 'Owner') throw new ConvexError("The owner's role can't be changed")
  return { org, me, target }
}

export const setRole = mutation({
  args: { memberId: v.id('members'), role: roles },
  handler: async (ctx, { memberId, role }) => {
    if (role === 'Owner') throw new ConvexError('Each organization has a single owner')
    const { target } = await teammate(ctx, memberId)
    await ctx.db.patch(target._id, { role })
  },
})

export const remove = mutation({
  args: { memberId: v.id('members') },
  handler: async (ctx, { memberId }) => {
    const { target, me } = await teammate(ctx, memberId)
    if (target._id === me._id) throw new ConvexError("You can't remove yourself")
    await ctx.db.delete(target._id)
  },
})
