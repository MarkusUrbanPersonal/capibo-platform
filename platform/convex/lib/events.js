import { internal } from '../_generated/api'
import { randomId } from './orgs'
import { iso } from './serialize'

/**
 * Queues a webhook event for every endpoint in the organization subscribed to
 * `type`. Runs inside the mutation that caused it, so events never fire for
 * changes that roll back.
 */
export async function emitEvent(ctx, orgId, type, data) {
  const endpoints = await ctx.db
    .query('webhooks')
    .withIndex('by_org', (q) => q.eq('orgId', orgId))
    .take(100)
  const subscribed = endpoints.filter((w) => w.events.includes(type))
  if (!subscribed.length) return
  const eventId = `evt_${randomId(12)}`
  const payload = JSON.stringify({ id: eventId, type, created_at: iso(Date.now()), data })
  for (const w of subscribed) {
    const deliveryId = await ctx.db.insert('webhookDeliveries', {
      webhookId: w._id,
      eventId,
      type,
      payload,
      attempts: 0,
      status: 'pending',
    })
    await ctx.scheduler.runAfter(0, internal.webhooks.deliver, { deliveryId })
  }
}
