import { query } from './_generated/server'
import { v } from 'convex/values'
import { requireMember } from './lib/orgs'
import { daysBetween, isoDay, windowEnding } from './lib/usage'

// Platform views of usage. `today` is the viewer's date, since queries can't read the clock.

const EMPTY = { submitted: 0, accepted: 0, rejected: 0, cost: 0 }
const round2 = (n) => Math.round(n * 100) / 100

async function rowsBetween(ctx, orgId, from, to) {
  return await ctx.db
    .query('usageDaily')
    .withIndex('by_org_and_date', (q) => q.eq('orgId', orgId).gte('date', from).lte('date', to))
    .take(8000)
}

/** Daily totals and a per-mission breakdown for the `days` ending on `today`. */
export const overview = query({
  args: { today: v.string(), days: v.number() },
  handler: async (ctx, { today, days }) => {
    const { org } = await requireMember(ctx)
    const [from, to] = windowEnding(today, Math.min(Math.max(days, 1), 366))
    const rows = await rowsBetween(ctx, org._id, from, to)

    const byDate = {}
    const byMission = {}
    for (const r of rows) {
      for (const bucket of [(byDate[r.date] ??= { ...EMPTY }), (byMission[r.missionId] ??= { ...EMPTY })]) {
        bucket.submitted += r.submitted
        bucket.accepted += r.accepted
        bucket.rejected += r.rejected
        bucket.cost += r.cost
      }
    }
    const daily = daysBetween(from, to).map((date) => {
      const d = byDate[date] ?? EMPTY
      return {
        date,
        ...d,
        cost: round2(d.cost),
        processed: d.accepted + d.rejected,
        processing: d.submitted - d.accepted - d.rejected,
      }
    })

    const missions = await Promise.all(Object.keys(byMission).map((id) => ctx.db.get(id)))
    const perMission = missions.map((m) => {
      const t = byMission[m._id]
      return { id: m.ref, name: m.name, ...t, cost: round2(t.cost), processed: t.accepted + t.rejected }
    })

    // Average QA score of accepted videos, across every mission so far.
    const all = await ctx.db
      .query('missions')
      .withIndex('by_org', (q) => q.eq('orgId', org._id))
      .take(200)
    const accepted = all.reduce((s, m) => s + m.accepted, 0)
    const avgQuality = accepted ? Math.round(all.reduce((s, m) => s + m.qualitySum, 0) / accepted) : null

    return { from, to, daily, byMission: perMission, avgQuality }
  },
})

/** Spend per calendar month for the last `months` months, oldest first. */
export const monthly = query({
  args: { today: v.string(), months: v.number() },
  handler: async (ctx, { today, months }) => {
    const { org } = await requireMember(ctx)
    const n = Math.min(Math.max(months, 1), 12)
    const [y, m] = today.split('-').map(Number)
    const keys = Array.from({ length: n }, (_, i) => isoDay(Date.UTC(y, m - n + i, 1)).slice(0, 7))
    const rows = await rowsBetween(ctx, org._id, `${keys[0]}-01`, today)
    const byMonth = Object.fromEntries(keys.map((k) => [k, { month: k, cost: 0, accepted: 0, submitted: 0 }]))
    for (const r of rows) {
      const b = byMonth[r.date.slice(0, 7)]
      if (!b) continue
      b.cost += r.cost
      b.accepted += r.accepted
      b.submitted += r.submitted
    }
    return keys.map((k) => ({ ...byMonth[k], cost: round2(byMonth[k].cost) }))
  },
})
