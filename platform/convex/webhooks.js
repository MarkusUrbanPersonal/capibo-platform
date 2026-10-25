import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { hmacSha256Hex } from './lib/crypto'

// Delivery of queued events (lib/events.js), signed as described in docs/guides/webhooks.mdx.

const TIMEOUT_MS = 10_000
const RETRY_FOR_MS = 3 * 86_400_000
const MAX_BACKOFF_MS = 6 * 3_600_000

export const delivery = internalQuery({
  args: { deliveryId: v.id('webhookDeliveries') },
  handler: async (ctx, { deliveryId }) => {
    const d = await ctx.db.get(deliveryId)
    if (!d || d.status !== 'pending') return null
    const endpoint = await ctx.db.get(d.webhookId)
    if (!endpoint) return null // deleted since the event fired
    return { url: endpoint.url, secret: endpoint.secret, payload: d.payload, eventId: d.eventId }
  },
})

export const deliver = internalAction({
  args: { deliveryId: v.id('webhookDeliveries') },
  handler: async (ctx, { deliveryId }) => {
    const d = await ctx.runQuery(internal.webhooks.delivery, { deliveryId })
    if (!d) return
    const t = Math.floor(Date.now() / 1000)
    const signature = await hmacSha256Hex(d.secret, `${t}.${d.payload}`)
    let error = null
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(d.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Capibo-Webhooks/1.0',
          'Capibo-Signature': `t=${t},v1=${signature}`,
          'Capibo-Event-Id': d.eventId,
        },
        body: d.payload,
        signal: abort.signal,
      })
      if (!res.ok) error = `HTTP ${res.status}`
    } catch (e) {
      error = abort.signal.aborted ? 'Timed out after 10s' : String(e?.message ?? e)
    } finally {
      clearTimeout(timer)
    }
    await ctx.runMutation(internal.webhooks.recordAttempt, { deliveryId, error: error ?? undefined })
  },
})

/** Marks a delivery done, or schedules a retry with exponential backoff for up to 3 days. */
export const recordAttempt = internalMutation({
  args: { deliveryId: v.id('webhookDeliveries'), error: v.optional(v.string()) },
  handler: async (ctx, { deliveryId, error }) => {
    const d = await ctx.db.get(deliveryId)
    if (!d) return
    const attempts = d.attempts + 1
    if (!error) return await ctx.db.patch(deliveryId, { attempts, status: 'succeeded', lastError: undefined })
    const backoff = Math.min(30_000 * 2 ** d.attempts, MAX_BACKOFF_MS)
    const giveUp = Date.now() + backoff - d._creationTime > RETRY_FOR_MS
    await ctx.db.patch(deliveryId, { attempts, lastError: error, status: giveUp ? 'failed' : 'pending' })
    if (!giveUp) await ctx.scheduler.runAfter(backoff, internal.webhooks.deliver, { deliveryId })
  },
})
