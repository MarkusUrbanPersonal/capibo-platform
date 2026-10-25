const nf = new Intl.NumberFormat('en-US')
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usdRound = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const formatNumber = (n) => nf.format(Math.round(n ?? 0))
export const formatCompact = (n) => compact.format(n ?? 0)
export const formatCurrency = (n) => usd.format(n ?? 0)
export const formatCurrencyRound = (n) => usdRound.format(n ?? 0)
export const formatPercent = (n, digits = 1) => `${(n ?? 0).toFixed(digits)}%`

export function formatDate(value, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const d = typeof value === 'string' && value.length === 10 ? new Date(value + 'T12:00:00Z') : new Date(value)
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', ...opts })
}

/** Today's date in UTC (YYYY-MM-DD), the day boundary usage is counted on. */
export const isoToday = () => new Date().toISOString().slice(0, 10)

export const formatShortDate = (value) => formatDate(value, { month: 'short', day: 'numeric' })

export function formatDateTime(value) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** "+12.4%" style delta between two numbers. */
export function formatDelta(current, previous) {
  if (!previous) return { label: '—', positive: true }
  const pct = ((current - previous) / previous) * 100
  return { label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, positive: pct >= 0 }
}

export function relativeTime(value, now = new Date('2026-10-25T18:00:00Z')) {
  const diff = (now - new Date(value)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  return days === 1 ? 'yesterday' : `${days}d ago`
}
