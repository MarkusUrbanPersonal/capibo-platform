import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError } from 'convex/values'

// Who may change what. Everyone in the organization can read.
export const CAN = {
  manageOrg: ['Owner', 'Admin'],
  manageTeam: ['Owner', 'Admin'],
  manageKeys: ['Owner', 'Admin', 'Developer', 'Data engineer'],
  manageBilling: ['Owner', 'Admin', 'Billing'],
  manageMissions: ['Owner', 'Admin', 'Developer', 'Data engineer'],
}

const ALPHANUM = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function randomId(length) {
  return Array.from({ length }, () => ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)]).join('')
}

export function txnRef() {
  return `TXN-${Math.floor(10000 + Math.random() * 90000)}`
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org'
}

/** New organization with its creator as Owner. New accounts start with no credits. */
export async function createOrganization(ctx, { userId, email, name, company }) {
  const orgName = company || `${name}'s organization`
  const orgId = await ctx.db.insert('organizations', {
    name: orgName,
    slug: slugify(orgName),
    publicId: `org_${randomId(10)}`,
    website: '',
    contact: email,
    plan: 'Pay as you go',
    balance: 0,
    monthlyBudget: 1000,
    autoRecharge: { enabled: false, threshold: 20, amount: 100 },
    billingDetails: { company: orgName, email, address: '', city: '', country: '', taxId: '' },
    retention: { raw: '365', rejected: '30', derived: 'forever', autoDelete: true },
  })
  await ctx.db.insert('members', { orgId, userId, email, name, role: 'Owner', pending: false, lastActiveAt: Date.now() })
  return orgId
}

/**
 * The signed-in user's membership and organization. Throws if signed out,
 * or if `allowed` roles are given and the member's role is not one of them.
 */
export async function requireMember(ctx, allowed) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError('Not signed in')
  const member = await ctx.db
    .query('members')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first()
  if (!member) throw new ConvexError('You are not a member of any organization')
  if (allowed && !allowed.includes(member.role)) {
    throw new ConvexError(`Your role (${member.role}) can't make this change`)
  }
  const org = await ctx.db.get(member.orgId)
  return { userId, member, org }
}
