import { api } from '@convex/_generated/api'
import { convex } from '@/lib/convex'
import { isoToday } from '@/lib/format'
import { sumRows } from '@/lib/usage'

/**
 * Scripted analytics agent for the Usage and Billing pages. It answers from the
 * same Convex queries the dashboards use, so numbers always match the page.
 */

export const ANALYTICS_MODEL = 'capibo-analyst-1'

// Slash commands in assistant-ui's shape; see SLASH_COMMANDS in missionAgent.js.
export const ANALYTICS_COMMANDS = [
  { id: 'summary', description: 'Key numbers for the last 30 days', icon: 'chart', category: 'Reports' },
  { id: 'quality', description: 'Acceptance by mission', icon: 'shield', category: 'Reports' },
  { id: 'missions', description: 'Usage and spend by mission', icon: 'target', category: 'Reports' },
  { id: 'forecast', description: 'Projected spend for this month', icon: 'trending', category: 'Billing' },
  { id: 'invoices', description: 'Latest invoices and payment status', icon: 'receipt', category: 'Billing' },
  { id: 'help', description: 'What the analyst can answer', icon: 'help', category: 'Conversation' },
]

const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const num = (n) => Math.round(n).toLocaleString('en-US')
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—')

const usage = (days) => convex.query(api.usage.overview, { today: isoToday(), days })
const NO_DATA = 'No videos have been submitted in the last 30 days, so there is nothing to report yet. Numbers appear here as soon as collectors start recording for your missions.'

async function summary(ctx) {
  await ctx.think('Aggregating the last 30 days of daily usage across all missions and comparing with the previous 30-day window.')
  const { daily } = await usage(60)
  const prev = sumRows(daily.slice(0, 30))
  const cur = sumRows(daily.slice(30))
  ctx.tool('query_usage', { range: 'last_30_days' }, {
    title: 'Last 30 days',
    metrics: [
      { label: 'Submitted', value: num(cur.submitted) },
      { label: 'Accepted', value: num(cur.accepted) },
      { label: 'Acceptance', value: pct(cur.accepted, cur.processed) },
      { label: 'Spend', value: usd(cur.cost) },
    ],
  })
  if (!cur.submitted) return ctx.say(NO_DATA)
  const change = prev.accepted ? `**${cur.accepted >= prev.accepted ? 'up' : 'down'} ${Math.abs(((cur.accepted - prev.accepted) / prev.accepted) * 100).toFixed(1)}%** versus the previous 30 days` : 'new this period'
  await ctx.say(
    `Accepted videos are ${change}.` +
      (cur.accepted ? ` Cost per accepted video is **$${(cur.cost / cur.accepted).toFixed(2)}**.` : ''),
  )
}

async function quality(ctx) {
  await ctx.think('Ranking missions by rejection rate over the last 30 days.')
  const { byMission } = await usage(30)
  const rows = byMission.filter((m) => m.processed > 0).sort((a, b) => b.rejected / b.processed - a.rejected / a.processed)
  ctx.tool('query_quality', { range: 'last_30_days' }, {
    title: 'Acceptance by mission',
    columns: ['Mission', 'Reviewed', 'Accepted'],
    rows: rows.map((m) => [m.name, num(m.processed), pct(m.accepted, m.processed)]),
  })
  if (!rows.length) return ctx.say('No videos have been reviewed in the last 30 days yet.')
  const worst = rows[0]
  await ctx.say(`**${worst.name}** has the highest rejection rate at **${pct(worst.rejected, worst.processed)}**. Open a rejected video in its dataset to see which quality checks it failed.`)
}

async function byMission(ctx) {
  await ctx.think('Summing accepted videos and spend per mission for the last 30 days, sorted by spend.')
  const rows = (await usage(30)).byMission.filter((m) => m.submitted > 0).sort((a, b) => b.cost - a.cost)
  ctx.tool('usage_by_mission', { range: 'last_30_days' }, {
    title: 'Usage by mission · 30 days',
    columns: ['Mission', 'Accepted', 'Spend'],
    rows: rows.map((m) => [m.name, num(m.accepted), usd(m.cost)]),
  })
  const total = rows.reduce((s, m) => s + m.cost, 0)
  if (!total) return ctx.say(NO_DATA)
  await ctx.say(`**${rows[0].name}** accounts for **${((rows[0].cost / total) * 100).toFixed(0)}%** of spend this period.`)
}

async function forecast(ctx) {
  await ctx.think('Projecting month-end spend from the month-to-date daily run rate.')
  const today = isoToday()
  const [[mtdRow], billing] = await Promise.all([
    convex.query(api.usage.monthly, { today, months: 1 }),
    convex.query(api.billing.overview, {}),
  ])
  const day = Number(today.slice(8, 10))
  const [y, m] = today.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const rate = mtdRow.cost / day
  const projected = rate * daysInMonth
  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  ctx.tool('forecast_spend', { month: today.slice(0, 7) }, {
    title: `${monthName} forecast`,
    metrics: [
      { label: 'Month to date', value: usd(mtdRow.cost) },
      { label: 'Projected', value: usd(projected) },
      { label: 'Budget', value: usd(billing.monthlyBudget) },
      { label: 'Credit balance', value: usd(billing.balance) },
    ],
  })
  if (!rate) return ctx.say(`Nothing has been charged this month yet, and your balance is **${usd(billing.balance)}**. Charges start when collectors' videos are reviewed.`)
  await ctx.say(
    `You're on track to spend **${usd(projected)}** this month — **${pct(projected, billing.monthlyBudget)}** of your budget. ` +
      `Your credit balance covers about **${Math.floor(billing.balance / rate)} days** at the current rate.`,
  )
}

async function invoiceStatus(ctx) {
  await ctx.think('Looking up the most recent invoices.')
  const { transactions } = await convex.query(api.billing.overview, {})
  const invoices = transactions.filter((t) => t.kind === 'invoice')
  if (!invoices.length) {
    return ctx.say('There are no invoices on this account. Capibo is prepaid: missions draw from your credit balance, which you can see under **Billing → Transactions**.')
  }
  ctx.tool('list_invoices', { limit: 3 }, {
    title: 'Recent invoices',
    columns: ['Invoice', 'Amount', 'Status'],
    rows: invoices.slice(0, 3).map((i) => [i.id, usd(i.amount), i.status === 'pending' ? 'Pending' : 'Paid']),
  })
  const pending = invoices.find((i) => i.status === 'pending')
  await ctx.say(pending ? `**${pending.id}** (${usd(pending.amount)}) is pending.` : 'All invoices are paid.')
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
