import { internalMutation } from './_generated/server'

const PROMO_CODES = [
  { code: 'CAL_HACKS', amount: 1000, label: 'Cal Hacks partner credit' },
  { code: 'CAPIBO_PILOT', amount: 250, label: 'Pilot mission credit' },
  { code: 'ROBOTICS_LAB', amount: 100, label: 'Research lab credit' },
]

/** Idempotent: `npx convex run seed:promoCodes`. Inserts missing codes and syncs the amount and label of existing ones. */
export const promoCodes = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const p of PROMO_CODES) {
      const existing = await ctx.db
        .query('promoCodes')
        .withIndex('by_code', (q) => q.eq('code', p.code))
        .first()
      if (!existing) await ctx.db.insert('promoCodes', { ...p, active: true })
      else if (existing.amount !== p.amount || existing.label !== p.label) {
        await ctx.db.patch(existing._id, { amount: p.amount, label: p.label })
      }
    }
  },
})

/**
 * One-off: `npx convex run seed:lowerOrgDefaults`. Moves organizations still on the
 * old defaults (budget $60,000, auto-recharge +$25,000 below $5,000) to the new ones.
 */
export const lowerOrgDefaults = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0
    for (const org of await ctx.db.query('organizations').collect()) {
      const patch = {}
      if (org.monthlyBudget === 60000) patch.monthlyBudget = 1000
      if (org.autoRecharge.threshold === 5000 && org.autoRecharge.amount === 25000) {
        patch.autoRecharge = { ...org.autoRecharge, threshold: 20, amount: 100 }
      }
      if (Object.keys(patch).length) {
        await ctx.db.patch(org._id, patch)
        updated++
      }
    }
    return { updated }
  },
})
