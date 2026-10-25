const DAY = 86_400_000
const EMPTY = { submitted: 0, accepted: 0, rejected: 0, cost: 0 }

export const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10)
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Every YYYY-MM-DD from `from` to `to`, inclusive. */
export function daysBetween(from, to) {
  const out = []
  for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += DAY) out.push(isoDay(t))
  return out
}

/** The `days`-long window ending on `today`, as [from, to]. */
export function windowEnding(today, days) {
  return [isoDay(Date.parse(today + 'T00:00:00Z') - (days - 1) * DAY), today]
}

/**
 * Daily submitted/accepted/rejected/cost, zero-filled, oldest first. Covers one
 * mission when `missionId` is set, otherwise the whole organization.
 */
export async function dailyUsage(ctx, { orgId, missionId, from, to }) {
  const rows = missionId
    ? await ctx.db
        .query('usageDaily')
        .withIndex('by_mission_and_date', (q) => q.eq('missionId', missionId).gte('date', from).lte('date', to))
        .take(1000)
    : await ctx.db
        .query('usageDaily')
        .withIndex('by_org_and_date', (q) => q.eq('orgId', orgId).gte('date', from).lte('date', to))
        .take(8000)
  const byDate = {}
  for (const r of rows) {
    const d = (byDate[r.date] ??= { ...EMPTY })
    d.submitted += r.submitted
    d.accepted += r.accepted
    d.rejected += r.rejected
    d.cost += r.cost
  }
  return daysBetween(from, to).map((date) => {
    const d = byDate[date] ?? EMPTY
    return { date, ...d, cost: Math.round(d.cost * 100) / 100 }
  })
}

/** Adds `delta` to the mission's counters for `date`. */
export async function addUsage(ctx, { orgId, missionId, date }, delta) {
  const row = await ctx.db
    .query('usageDaily')
    .withIndex('by_mission_and_date', (q) => q.eq('missionId', missionId).eq('date', date))
    .unique()
  if (!row) return ctx.db.insert('usageDaily', { orgId, missionId, date, ...EMPTY, ...delta })
  const next = {}
  for (const [k, n] of Object.entries(delta)) next[k] = row[k] + n
  await ctx.db.patch(row._id, next)
}
