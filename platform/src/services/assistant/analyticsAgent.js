import {
  billing, dailyUsage, invoices, missionTotals, sumRows, videos, TODAY,
} from '@/data/mock'

/**
 * Mock analytics agent for the Usage and Billing pages. It answers from the
 * same centralized demo data the charts use, so numbers always match the page.
 */

export const ANALYTICS_MODEL = 'capibo-analyst-1'

// Slash commands in assistant-ui's shape; see SLASH_COMMANDS in missionAgent.js.
export const ANALYTICS_COMMANDS = [
  { id: 'summary', description: 'Key numbers for the last 30 days', icon: 'chart', category: 'Reports' },
  { id: 'quality', description: 'Rejection reasons and problem missions', icon: 'shield', category: 'Reports' },
  { id: 'missions', description: 'Usage and spend by mission', icon: 'target', category: 'Reports' },
  { id: 'forecast', description: 'Projected spend for this month', icon: 'trending', category: 'Billing' },
  { id: 'invoices', description: 'Latest invoices and payment status', icon: 'receipt', category: 'Billing' },
  { id: 'help', description: 'What the analyst can answer', icon: 'help', category: 'Conversation' },
]

const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const num = (n) => Math.round(n).toLocaleString('en-US')
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—')

function last(days) {
  return sumRows(dailyUsage.slice(-days))
}

async function summary(ctx) {
  const cur = last(30)
  const prev = sumRows(dailyUsage.slice(-60, -30))
  await ctx.think('Aggregating the last 30 days of daily usage across all missions and comparing with the previous 30-day window.')
  ctx.tool('query_usage', { range: 'last_30_days' }, {
    title: 'Last 30 days',
    metrics: [
      { label: 'Submitted', value: num(cur.submitted) },
      { label: 'Accepted', value: num(cur.accepted) },
      { label: 'Acceptance', value: pct(cur.accepted, cur.processed) },
      { label: 'Spend', value: usd(cur.cost) },
    ],
  })
  const change = ((cur.accepted - prev.accepted) / prev.accepted) * 100
  await ctx.say(
    `Accepted videos are **${change >= 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}%** versus the previous 30 days. ` +
      (change < 0
        ? 'Most of the drop comes from **Warehouse tote picking** completing on Sep 15 — your running missions are growing week over week.'
        : 'Growth is driven by the laundry and dishwasher missions ramping up.') +
      ` Cost per accepted video is **$${(cur.cost / cur.accepted).toFixed(2)}**.`,
  )
}

async function quality(ctx) {
  await ctx.think('Grouping rejected videos by their primary QA failure, then ranking missions by rejection rate over the last 30 days.')
  const counts = {}
  for (const v of videos) if (v.rejectionReason) counts[v.rejectionReason] = (counts[v.rejectionReason] ?? 0) + 1
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const reasons = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  ctx.tool('query_quality', { range: 'last_30_days' }, {
    title: 'Top rejection reasons',
    columns: ['Reason', 'Share'],
    rows: reasons.map(([r, n]) => [r, `${Math.round((n / total) * 100)}%`]),
  })
  const worst = missionTotals(30)
    .filter((m) => m.processed > 50)
    .sort((a, b) => b.rejected / b.processed - a.rejected / a.processed)[0]
  await ctx.say(
    `**${worst.name}** has the highest rejection rate at **${pct(worst.rejected, worst.processed)}**. ` +
      `The leading cause platform-wide is *${reasons[0][0].toLowerCase()}*. Adding a lighting check to the in-app recording guide typically cuts these rejections by a third.`,
  )
}

async function byMission(ctx) {
  await ctx.think('Summing accepted videos and spend per mission for the last 30 days, sorted by spend.')
  const rows = missionTotals(30).filter((m) => m.submitted > 0).sort((a, b) => b.cost - a.cost)
  ctx.tool('usage_by_mission', { range: 'last_30_days' }, {
    title: 'Usage by mission · 30 days',
    columns: ['Mission', 'Accepted', 'Spend'],
    rows: rows.map((m) => [m.name, num(m.accepted), usd(m.cost)]),
  })
  const top = rows[0]
  const share = (top.cost / rows.reduce((s, m) => s + m.cost, 0)) * 100
  await ctx.say(`**${top.name}** accounts for **${share.toFixed(0)}%** of spend this period.`)
}

async function forecast(ctx) {
  await ctx.think('Projecting month-end spend from month-to-date daily run rate, adjusting for weekends which run ~28% higher.')
  const month = TODAY.toISOString().slice(0, 7)
  const mtdRows = dailyUsage.filter((r) => r.date.startsWith(month))
  const mtd = mtdRows.reduce((s, r) => s + r.cost, 0)
  const daysInMonth = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() + 1, 0)).getUTCDate()
  const projected = (mtd / mtdRows.length) * daysInMonth
  ctx.tool('forecast_spend', { month }, {
    title: 'October 2026 forecast',
    metrics: [
      { label: 'Month to date', value: usd(mtd) },
      { label: 'Projected', value: usd(projected) },
      { label: 'Budget', value: usd(billing.monthlyBudget) },
      { label: 'Credit balance', value: usd(billing.balance) },
    ],
  })
  const runway = billing.balance / (mtd / mtdRows.length)
  await ctx.say(
    `You're on track to spend **${usd(projected)}** this month — **${pct(projected, billing.monthlyBudget)}** of your budget. ` +
      `Your credit balance covers about **${Math.floor(runway)} days** at the current rate; auto-recharge adds ${usd(billing.autoRecharge.amount)} below ${usd(billing.autoRecharge.threshold)}.`,
  )
}

async function invoiceStatus(ctx) {
  await ctx.think('Looking up the three most recent invoices and the default payment method.')
  ctx.tool('list_invoices', { limit: 3 }, {
    title: 'Recent invoices',
    columns: ['Invoice', 'Amount', 'Status'],
    rows: invoices.slice(0, 3).map((i) => [i.id, usd(i.amount), i.status === 'paid' ? 'Paid' : 'Pending']),
  })
  const pending = invoices.find((i) => i.status === 'pending')
  await ctx.say(
    pending
      ? `**${pending.id}** (${usd(pending.amount)}) is pending and will be settled from your prepaid credits on Nov 1. All earlier invoices are paid.`
      : 'All invoices are paid.',
  )
}

async function help(ctx) {
  await ctx.say(
    [
      'I can answer questions about consumption and spend, using the same data as these dashboards. Try:',
      '',
      '- *Why are videos being rejected?*',
      '- *Which mission costs the most?*',
      '- *What will we spend this month?*',
      '- *Is there anything unpaid?*',
      '',
      'Or type `/` for commands.',
    ].join('\n'),
  )
}

export async function analyticsAgent(input, ctx) {
  const t = input.trim().toLowerCase()
  const cmd = t.startsWith('/') ? t.split(/\s+/)[0] : null
  if (cmd === '/help' || /^(help|what can you)/.test(t)) return help(ctx)
  if (cmd === '/quality' || /reject|quality|fail|why/.test(t)) return quality(ctx)
  if (cmd === '/forecast' || /forecast|project|budget|this month|run ?rate|runway|credit/.test(t)) return forecast(ctx)
  if (cmd === '/invoices' || /invoice|unpaid|payment|paid|bill/.test(t)) return invoiceStatus(ctx)
  if (cmd === '/missions' || /mission|most|breakdown|which/.test(t)) return byMission(ctx)
  return summary(ctx)
}
