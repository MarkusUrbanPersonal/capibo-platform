import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { apiError, missing } from './lib/errors'
import { CAN, requireMember, txnRef } from './lib/orgs'

const MIN_TOP_UP = 20

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const { org } = await requireMember(ctx)
    const txns = await ctx.db
      .query('transactions')
      .withIndex('by_org', (q) => q.eq('orgId', org._id))
      .order('desc')
      .collect()
    return {
      plan: org.plan,
      balance: org.balance,
      monthlyBudget: org.monthlyBudget,
      autoRecharge: org.autoRecharge,
      billingDetails: org.billingDetails,
      transactions: txns.map((t) => ({
        id: t.ref,
        date: new Date(t._creationTime).toISOString().slice(0, 10),
        description: t.description,
        amount: t.amount,
        status: t.status,
        kind: t.kind,
        promoCode: t.promoCode ?? null,
      })),
    }
  },
})

async function findPromo(ctx, rawCode) {
  const code = rawCode.trim().toUpperCase()
  if (!code) return { code, promo: null }
  const promo = await ctx.db
    .query('promoCodes')
    .withIndex('by_code', (q) => q.eq('code', code))
    .first()
  return { code, promo: promo?.active ? promo : null }
}

async function alreadyRedeemed(ctx, orgId, code) {
  const row = await ctx.db
    .query('transactions')
    .withIndex('by_org_promo', (q) => q.eq('orgId', orgId).eq('promoCode', code))
    .first()
  return row !== null
}

/** Live preview while typing a promo code. Null unless the code is valid and unused on this account. */
export const lookupPromo = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const { org } = await requireMember(ctx)
    const { code, promo } = await findPromo(ctx, args.code)
    if (!promo || (await alreadyRedeemed(ctx, org._id, code))) return null
    return { code, amount: promo.amount, label: promo.label }
  },
})

/**
 * Adds a promo code's credit to the organization. Shared by the platform and the
 * REST API, so the errors use the API's codes. Returns the new transaction.
 */
export async function redeemCode(ctx, org, rawCode, userId) {
  const { code, promo } = await findPromo(ctx, rawCode)
  if (!code) throw missing('code')
  if (!promo) throw apiError(404, 'promo_code_invalid', `"${code}" isn't a valid promo code.`)
  if (await alreadyRedeemed(ctx, org._id, code)) {
    throw apiError(409, 'promo_code_redeemed', `${code} has already been redeemed on this account.`)
  }
  const txnId = await ctx.db.insert('transactions', {
    orgId: org._id,
    ref: txnRef(),
    description: `Promo code ${code} redeemed`,
    amount: promo.amount,
    status: 'succeeded',
    kind: 'promo',
    promoCode: code,
    userId,
  })
  await ctx.db.patch(org._id, { balance: org.balance + promo.amount })
  return { code, promo, transaction: await ctx.db.get(txnId) }
}

export const redeemPromo = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const { org, userId } = await requireMember(ctx, CAN.manageBilling)
    const { code, promo } = await redeemCode(ctx, org, args.code, userId)
    return { code, amount: promo.amount, label: promo.label }
  },
})

/** Demo card checkout: credits the balance without charging anything. */
export const topUp = mutation({
  args: { amount: v.number() },
  handler: async (ctx, { amount }) => {
    const { org, userId } = await requireMember(ctx, CAN.manageBilling)
    if (!Number.isFinite(amount) || amount < MIN_TOP_UP) throw new ConvexError(`Minimum top-up is $${MIN_TOP_UP}`)
    const rounded = Math.round(amount * 100) / 100
    await ctx.db.insert('transactions', {
      orgId: org._id,
      ref: txnRef(),
      description: 'Credit top-up · card checkout',
      amount: rounded,
      status: 'succeeded',
      kind: 'credit',
      userId,
    })
    await ctx.db.patch(org._id, { balance: org.balance + rounded })
  },
})

export const updateDetails = mutation({
  args: {
    company: v.string(),
    email: v.string(),
    address: v.string(),
    city: v.string(),
    country: v.string(),
    taxId: v.string(),
  },
  handler: async (ctx, billingDetails) => {
    const { org } = await requireMember(ctx, CAN.manageBilling)
    if (!billingDetails.company.trim()) throw new ConvexError('Company is required')
    await ctx.db.patch(org._id, { billingDetails })
  },
})

export const setAutoRecharge = mutation({
  args: { enabled: v.optional(v.boolean()), threshold: v.optional(v.number()), amount: v.optional(v.number()) },
  handler: async (ctx, changes) => {
    const { org } = await requireMember(ctx, CAN.manageBilling)
    const next = { ...org.autoRecharge }
    for (const [k, val] of Object.entries(changes)) if (val !== undefined) next[k] = val
    if (next.threshold <= 0 || next.amount <= 0) throw new ConvexError('Amounts must be positive')
    await ctx.db.patch(org._id, { autoRecharge: next })
  },
})
