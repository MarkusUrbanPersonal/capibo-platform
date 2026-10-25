import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'

const WEEK = 7 * 86_400_000
const BATCH = 500

/** Drops expired Idempotency-Key records and week-old webhook deliveries. */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const keys = await ctx.db
      .query('idempotencyKeys')
      .withIndex('by_expiresAt', (q) => q.lt('expiresAt', now))
      .take(BATCH)
    const deliveries = await ctx.db
      .query('webhookDeliveries')
      .withIndex('by_creation_time', (q) => q.lt('_creationTime', now - WEEK))
      .take(BATCH)
    for (const row of [...keys, ...deliveries]) await ctx.db.delete(row._id)
    // More left over: keep going in a fresh transaction.
    if (keys.length === BATCH || deliveries.length === BATCH) await ctx.scheduler.runAfter(0, internal.crons.cleanup, {})
  },
})

const crons = cronJobs()
crons.interval('clean up API bookkeeping', { hours: 1 }, internal.crons.cleanup, {})
export default crons
