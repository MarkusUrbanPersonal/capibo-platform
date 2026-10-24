/**
 * Centralized demo data for Capibo.
 *
 * Everything (charts, KPIs, tables, billing) is derived from the same seeded
 * per-mission daily series below, so numbers agree across pages. Replace the
 * exports of this module (or src/services/api.js) with real API calls later.
 */

export const TODAY = new Date('2026-10-23T12:00:00Z')
const DAY = 86_400_000
const HISTORY_DAYS = 365

// Deterministic PRNG (mulberry32) so the demo is stable across reloads.
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const isoDay = (d) => new Date(d).toISOString().slice(0, 10)
const daysAgo = (n) => new Date(TODAY.getTime() - n * DAY)

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

export const missions = [
  {
    id: 'MSN-1042',
    name: 'Household laundry folding',
    description: 'Egocentric videos of people folding everyday garments for a clothes-folding robot policy.',
    status: 'active',
    start: '2026-08-04',
    end: null,
    target: 10000,
    pricePerVideo: 3.2,
    acceptRate: 0.86,
    dailyBase: 92,
    regions: ['US', 'PT', 'MX'],
    tasks: [
      { id: 'T-1', name: 'Lay garment flat', duration: [12, 25], labels: ['garment', 'table-top', 'two-hand'] },
      { id: 'T-2', name: 'Fold t-shirt', duration: [20, 45], labels: ['t-shirt', 'fold', 'two-hand'] },
      { id: 'T-3', name: 'Fold trousers', duration: [25, 50], labels: ['trousers', 'fold', 'two-hand'] },
      { id: 'T-4', name: 'Fold towel', duration: [15, 35], labels: ['towel', 'fold'] },
      { id: 'T-5', name: 'Stack folded clothes', duration: [10, 22], labels: ['stack', 'place'] },
    ],
  },
  {
    id: 'MSN-1038',
    name: 'Dishwasher loading',
    description: 'Loading plates, cups and cutlery into front-loading dishwashers in real kitchens.',
    status: 'active',
    start: '2026-07-10',
    end: null,
    target: 16000,
    pricePerVideo: 2.8,
    acceptRate: 0.82,
    dailyBase: 118,
    regions: ['US', 'DE', 'UK'],
    tasks: [
      { id: 'T-1', name: 'Open dishwasher', duration: [6, 14], labels: ['appliance', 'door'] },
      { id: 'T-2', name: 'Load plates', duration: [20, 40], labels: ['plate', 'rack', 'place'] },
      { id: 'T-3', name: 'Load glasses', duration: [18, 36], labels: ['glass', 'fragile', 'place'] },
      { id: 'T-4', name: 'Load cutlery basket', duration: [15, 30], labels: ['cutlery', 'sort'] },
    ],
  },
  {
    id: 'MSN-1045',
    name: 'Grocery bagging',
    description: 'Packing groceries into reusable bags at a checkout counter with mixed item fragility.',
    status: 'active',
    start: '2026-09-20',
    end: null,
    target: 6000,
    pricePerVideo: 2.4,
    acceptRate: 0.88,
    dailyBase: 74,
    regions: ['US', 'CA'],
    tasks: [
      { id: 'T-1', name: 'Open bag', duration: [5, 12], labels: ['bag', 'two-hand'] },
      { id: 'T-2', name: 'Pack heavy items', duration: [15, 30], labels: ['heavy', 'place'] },
      { id: 'T-3', name: 'Pack fragile items', duration: [15, 32], labels: ['fragile', 'eggs', 'place'] },
    ],
  },
  {
    id: 'MSN-1047',
    name: 'Retail shelf restocking',
    description: 'Facing and restocking packaged goods on supermarket shelves.',
    status: 'active',
    start: '2026-10-12',
    end: null,
    target: 4000,
    pricePerVideo: 4.1,
    acceptRate: 0.79,
    dailyBase: 46,
    regions: ['UK', 'ES'],
    tasks: [
      { id: 'T-1', name: 'Pick item from cart', duration: [6, 14], labels: ['pick', 'box'] },
      { id: 'T-2', name: 'Place on shelf', duration: [8, 18], labels: ['place', 'shelf'] },
      { id: 'T-3', name: 'Face products', duration: [12, 26], labels: ['align', 'shelf'] },
    ],
  },
  {
    id: 'MSN-1048',
    name: 'Cable plugging & unplugging',
    description: 'Inserting and removing USB-C, HDMI and power plugs for dexterous manipulation.',
    status: 'dispatching',
    start: '2026-10-22',
    end: null,
    target: 3000,
    pricePerVideo: 5.6,
    acceptRate: 0.74,
    dailyBase: 18,
    regions: ['US'],
    tasks: [
      { id: 'T-1', name: 'Plug USB-C', duration: [5, 12], labels: ['usb-c', 'precision'] },
      { id: 'T-2', name: 'Unplug HDMI', duration: [5, 10], labels: ['hdmi', 'precision'] },
    ],
  },
  {
    id: 'MSN-1031',
    name: 'Bed making',
    description: 'Fitting sheets, arranging duvets and pillows on single and double beds.',
    status: 'paused',
    start: '2026-06-01',
    end: null,
    pausedOn: '2026-09-28',
    target: 6500,
    pricePerVideo: 3.9,
    acceptRate: 0.8,
    dailyBase: 40,
    regions: ['PT', 'BR'],
    tasks: [
      { id: 'T-1', name: 'Fit bottom sheet', duration: [30, 60], labels: ['sheet', 'bed'] },
      { id: 'T-2', name: 'Spread duvet', duration: [20, 40], labels: ['duvet', 'bed'] },
      { id: 'T-3', name: 'Arrange pillows', duration: [8, 18], labels: ['pillow', 'place'] },
    ],
  },
  {
    id: 'MSN-1024',
    name: 'Warehouse tote picking',
    description: 'Picking SKUs from cluttered totes for a warehouse pick-and-place model.',
    status: 'completed',
    start: '2026-04-20',
    end: '2026-08-28',
    target: 13500,
    pricePerVideo: 2.2,
    acceptRate: 0.9,
    dailyBase: 128,
    regions: ['US', 'PL'],
    tasks: [
      { id: 'T-1', name: 'Pick from tote', duration: [6, 15], labels: ['pick', 'clutter'] },
      { id: 'T-2', name: 'Place in bin', duration: [5, 12], labels: ['place', 'bin'] },
    ],
  },
  {
    id: 'MSN-1017',
    name: 'Kitchen countertop wiping',
    description: 'Wiping spills and crumbs from countertops with cloths and sponges.',
    status: 'completed',
    start: '2026-02-16',
    end: '2026-07-30',
    target: 7000,
    pricePerVideo: 1.9,
    acceptRate: 0.87,
    dailyBase: 52,
    regions: ['US', 'IN'],
    tasks: [
      { id: 'T-1', name: 'Wipe spill', duration: [10, 25], labels: ['wipe', 'liquid'] },
      { id: 'T-2', name: 'Sweep crumbs', duration: [8, 20], labels: ['sweep', 'crumbs'] },
    ],
  },
]

export const missionById = Object.fromEntries(missions.map((m) => [m.id, m]))

// Platform processing fee per submitted video (QA pipeline + labeling).
export const PROCESSING_FEE = 0.15

// ---------------------------------------------------------------------------
// Daily series (per mission and aggregated)
// ---------------------------------------------------------------------------

function buildMissionDaily(mission, seed) {
  const rand = rng(seed)
  const start = new Date(mission.start + 'T12:00:00Z').getTime()
  const stop = mission.end
    ? new Date(mission.end + 'T12:00:00Z').getTime()
    : mission.pausedOn
      ? new Date(mission.pausedOn + 'T12:00:00Z').getTime()
      : TODAY.getTime()
  const rows = {}
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const d = daysAgo(i)
    const t = d.getTime()
    if (t < start || t > stop) continue
    const age = Math.round((t - start) / DAY)
    const ramp = Math.min(1, 0.25 + age / 21) // missions ramp up over ~3 weeks
    // Running missions keep growing as more collectors join.
    const growth = mission.end ? 1 : 1 + Math.min(age, 150) / 260
    const weekday = d.getUTCDay()
    const weekFactor = weekday === 0 || weekday === 6 ? 1.28 : 1 // collectors record more at weekends
    const noise = 0.78 + rand() * 0.44
    const submitted = Math.round(mission.dailyBase * ramp * growth * weekFactor * noise)
    const processingShare = i === 0 ? 0.62 : i === 1 ? 0.24 : i === 2 ? 0.07 : 0
    const processing = Math.round(submitted * processingShare)
    const processed = submitted - processing
    const rate = Math.min(0.97, Math.max(0.6, mission.acceptRate + (rand() - 0.5) * 0.06))
    const accepted = Math.round(processed * rate)
    const rejected = processed - accepted
    rows[isoDay(d)] = { submitted, processing, processed, accepted, rejected }
  }
  return rows
}

export const missionDaily = Object.fromEntries(
  missions.map((m, i) => [m.id, buildMissionDaily(m, 1000 + i * 97)]),
)

/** Aggregated platform-wide daily series, oldest → newest. */
export const dailyUsage = Array.from({ length: HISTORY_DAYS }, (_, idx) => {
  const date = isoDay(daysAgo(HISTORY_DAYS - 1 - idx))
  const row = { date, submitted: 0, processing: 0, processed: 0, accepted: 0, rejected: 0, cost: 0 }
  for (const m of missions) {
    const r = missionDaily[m.id][date]
    if (!r) continue
    row.submitted += r.submitted
    row.processing += r.processing
    row.processed += r.processed
    row.accepted += r.accepted
    row.rejected += r.rejected
    row.cost += r.accepted * m.pricePerVideo + r.submitted * PROCESSING_FEE
  }
  row.cost = Math.round(row.cost * 100) / 100
  return row
})

export const RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
  { value: '180d', label: 'Last 6 months', days: 180 },
]

export function rangeDays(value) {
  return RANGE_OPTIONS.find((r) => r.value === value)?.days ?? 30
}

/** Daily rows within the last `days` days. */
export function usageForRange(days, missionId = null) {
  const rows = dailyUsage.slice(-days)
  if (!missionId) return rows
  const series = missionDaily[missionId]
  const m = missionById[missionId]
  return rows.map(({ date }) => {
    const r = series[date] ?? { submitted: 0, processing: 0, processed: 0, accepted: 0, rejected: 0 }
    return { date, ...r, cost: Math.round((r.accepted * m.pricePerVideo + r.submitted * PROCESSING_FEE) * 100) / 100 }
  })
}

export function sumRows(rows) {
  return rows.reduce(
    (acc, r) => {
      acc.submitted += r.submitted
      acc.processing += r.processing
      acc.processed += r.processed
      acc.accepted += r.accepted
      acc.rejected += r.rejected
      acc.cost += r.cost
      return acc
    },
    { submitted: 0, processing: 0, processed: 0, accepted: 0, rejected: 0, cost: 0 },
  )
}

/** Sum of the `days` preceding the current window, for period-over-period deltas. */
export function previousPeriod(days) {
  return sumRows(dailyUsage.slice(-days * 2, -days))
}

/** Per-mission totals over a window (default: all time). */
export function missionTotals(days = HISTORY_DAYS) {
  const dates = dailyUsage.slice(-days).map((r) => r.date)
  return missions.map((m) => {
    const t = { submitted: 0, processing: 0, processed: 0, accepted: 0, rejected: 0 }
    for (const date of dates) {
      const r = missionDaily[m.id][date]
      if (!r) continue
      for (const k in t) t[k] += r[k]
    }
    const cost = t.accepted * m.pricePerVideo + t.submitted * PROCESSING_FEE
    return { ...m, ...t, cost, progress: Math.min(100, Math.round((totalsAll[m.id].accepted / m.target) * 100)) }
  })
}

const totalsAll = Object.fromEntries(
  missions.map((m) => {
    const t = { accepted: 0, submitted: 0 }
    for (const r of Object.values(missionDaily[m.id])) {
      t.accepted += r.accepted
      t.submitted += r.submitted
    }
    return [m.id, t]
  }),
)

export const missionsWithStats = missionTotals()

// ---------------------------------------------------------------------------
// Videos (the most recent submissions; the library pages through these)
// ---------------------------------------------------------------------------

const DEVICES = ['iPhone 16 Pro', 'iPhone 15', 'Pixel 9 Pro', 'Galaxy S25', 'iPhone 17', 'Pixel 10']
const REGIONS = { US: 'United States', PT: 'Portugal', MX: 'Mexico', DE: 'Germany', UK: 'United Kingdom', CA: 'Canada', ES: 'Spain', BR: 'Brazil', PL: 'Poland', IN: 'India' }
const REJECTIONS = [
  'Hands leave frame for more than 2s',
  'Insufficient lighting',
  'Motion blur above threshold',
  'Task not completed',
  'Face visible without consent',
  'Camera not egocentric',
  'Duplicate submission',
]

function buildVideos() {
  const rand = rng(4242)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const live = missions.filter((m) => m.status !== 'completed')
  const recentlyLive = [...live, missionById['MSN-1024']]
  const videos = []
  for (let i = 0; i < 360; i++) {
    const ageDays = Math.floor(Math.pow(rand(), 1.6) * 60)
    const created = new Date(TODAY.getTime() - ageDays * DAY - Math.floor(rand() * DAY))
    const date = isoDay(created)
    const candidates = recentlyLive.filter((m) => missionDaily[m.id][date])
    const mission = candidates.length ? pick(candidates) : pick(live)
    const task = pick(mission.tasks)
    const duration = Math.round(task.duration[0] + rand() * (task.duration[1] - task.duration[0]))
    let status
    if (ageDays <= 1 && rand() < (ageDays === 0 ? 0.6 : 0.25)) status = 'processing'
    else status = rand() < mission.acceptRate ? 'accepted' : 'rejected'
    const quality = status === 'processing' ? null : status === 'accepted' ? Math.round(82 + rand() * 17) : Math.round(38 + rand() * 30)
    const fps = rand() < 0.7 ? 30 : 60
    const regionCode = pick(mission.regions)
    videos.push({
      id: `VID-${(784210 - i * 7 - Math.floor(rand() * 5)).toString()}`,
      missionId: mission.id,
      mission: mission.name,
      task: task.name,
      taskId: task.id,
      duration,
      status,
      quality,
      createdAt: created.toISOString(),
      date,
      device: pick(DEVICES),
      resolution: rand() < 0.8 ? '1920×1080' : '3840×2160',
      fps,
      sizeMb: Math.round(duration * (fps === 60 ? 3.1 : 1.7) * 10) / 10,
      collector: `C-${Math.floor(10000 + rand() * 89999)}`,
      region: REGIONS[regionCode],
      labels: task.labels,
      checks: {
        handsInFrame: status === 'rejected' && rand() < 0.4 ? false : true,
        lighting: Math.round((status === 'rejected' ? 0.45 : 0.8) * 100 + rand() * 18),
        blur: Math.round((status === 'rejected' ? 0.3 : 0.06) * 100 * (0.6 + rand() * 0.8)),
        taskComplete: status !== 'rejected' || rand() < 0.5,
        privacy: status !== 'rejected' || rand() < 0.85,
      },
      rejectionReason: status === 'rejected' ? pick(REJECTIONS) : null,
    })
  }
  return videos.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const videos = buildVideos()

// ---------------------------------------------------------------------------
// Datasets (exportable bundles of accepted videos)
// ---------------------------------------------------------------------------

export const datasets = missionsWithStats
  .filter((m) => m.accepted > 0)
  .map((m, i) => ({
    id: `DS-${String(301 + i)}`,
    name: `${m.name} · v${m.status === 'completed' ? '2.0' : '1.' + (i + 2)}`,
    missionId: m.id,
    videos: m.accepted,
    hours: Math.round((m.accepted * 24) / 3600),
    updatedAt: m.end ?? isoDay(TODAY),
  }))

export const datasetById = Object.fromEntries(datasets.map((d) => [d.id, d]))
export const datasetByMission = Object.fromEntries(datasets.map((d) => [d.missionId, d]))

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

export const activity = [
  { id: 1, type: 'dispatch', title: 'Mission dispatched to collectors', detail: 'Cable plugging & unplugging · 2 tasks sent to 412 collectors', at: '2026-10-22T16:41:00Z' },
  { id: 2, type: 'quality', title: 'Quality threshold reached', detail: 'Household laundry folding passed 86% acceptance for 7 days', at: '2026-10-22T09:15:00Z' },
  { id: 3, type: 'export', title: 'Dataset exported', detail: 'Dishwasher loading · v1.3 → s3://timefactories/datasets (8.4k videos)', at: '2026-10-21T18:02:00Z' },
  { id: 4, type: 'alert', title: 'Rejection spike detected', detail: 'Retail shelf restocking · "Insufficient lighting" up 12% in 24h', at: '2026-10-21T07:48:00Z' },
  { id: 5, type: 'billing', title: 'Credits topped up', detail: '$25,000.00 added by Markus Urban', at: '2026-10-20T14:30:00Z' },
  { id: 6, type: 'member', title: 'Team member invited', detail: 'leonardo@timefactories.com joined as Admin', at: '2026-10-18T11:05:00Z' },
  { id: 7, type: 'mission', title: 'Mission created', detail: 'Retail shelf restocking · 3 tasks · 4,000 video target', at: '2026-10-12T10:20:00Z' },
]

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

function monthlyCosts() {
  const byMonth = {}
  for (const r of dailyUsage) {
    const key = r.date.slice(0, 7)
    byMonth[key] ??= { month: key, cost: 0, accepted: 0, submitted: 0 }
    byMonth[key].cost += r.cost
    byMonth[key].accepted += r.accepted
    byMonth[key].submitted += r.submitted
  }
  return Object.values(byMonth).map((m) => ({ ...m, cost: Math.round(m.cost * 100) / 100 }))
}

export const monthlySpend = monthlyCosts().filter((m) => m.cost > 0)

export const billing = {
  plan: 'Enterprise',
  balance: 18420.55,
  creditLimit: 50000,
  monthlyBudget: 60000,
  // No card on file: the account was funded with a promo code. Auto-recharge needs a card, so it starts off.
  autoRecharge: { enabled: false, threshold: 5000, amount: 25000 },
  paymentMethod: null,
  promo: { code: 'CAL_HACKS', amount: 50000, redeemedAt: '2026-07-02' },
  billingDetails: {
    company: 'Timefactories Inc.',
    email: 'finance@timefactories.com',
    address: '500 Howard St, Suite 300',
    city: 'San Francisco, CA 94105',
    country: 'United States',
    taxId: 'US 87-1234567',
  },
}

export const invoices = monthlySpend
  .filter((m) => m.month < isoDay(TODAY).slice(0, 7))
  .map((m, i, all) => {
    const [y, mo] = m.month.split('-').map(Number)
    const issued = new Date(Date.UTC(y, mo, 1))
    return {
      id: `INV-${y}${String(mo).padStart(2, '0')}-${String(1100 + i)}`,
      date: isoDay(issued),
      period: m.month,
      description: `Video collection & processing · ${new Date(Date.UTC(y, mo - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
      amount: m.cost,
      status: i === all.length - 1 ? 'pending' : 'paid',
      kind: 'invoice',
    }
  })
  .reverse()

// A single prepaid credit: the account has been funded once, with a promo code.
export const transactions = [
  { id: 'TXN-81009', date: '2026-07-02', description: 'Promo code CAL_HACKS redeemed', amount: 50000, status: 'succeeded', kind: 'promo' },
]

// Redeemable promo codes (demo). CAL_HACKS is already used by this account.
export const promoCodes = {
  CAL_HACKS: { amount: 50000, label: 'Cal Hacks partner credit' },
  CAPIBO_PILOT: { amount: 5000, label: 'Pilot mission credit' },
  ROBOTICS_LAB: { amount: 2500, label: 'Research lab credit' },
}

// ---------------------------------------------------------------------------
// Organization / settings
// ---------------------------------------------------------------------------

export const organization = {
  name: 'Timefactories',
  slug: 'timefactories',
  id: 'org_7Hq2kR9xLm',
  plan: 'Enterprise',
  region: 'US (us-west-2)',
  createdAt: '2026-02-03',
}

export const currentUser = {
  name: 'Markus Urban',
  email: 'markus@timefactories.com',
  initials: 'MU',
  role: 'Owner',
}

export const members = [
  { name: 'Markus Urban', email: 'markus@timefactories.com', role: 'Owner', initials: 'MU', lastActive: 'Now' },
  { name: 'Leonardo C.', email: 'leonardo@timefactories.com', role: 'Admin', initials: 'LC', lastActive: '2h ago' },
]

// Placeholder values only — real keys are never shipped to the client.
export const apiKeys = [
  { id: 'key_1', name: 'Training pipeline', prefix: 'cpb_live_••••••••••••7f2a', created: '2026-03-14', lastUsed: '3 min ago', scope: 'Read datasets' },
  { id: 'key_2', name: 'Mission automation', prefix: 'cpb_live_••••••••••••c19e', created: '2026-06-02', lastUsed: '1 day ago', scope: 'Full access' },
  { id: 'key_3', name: 'Staging', prefix: 'cpb_test_••••••••••••04bd', created: '2026-09-21', lastUsed: 'Never', scope: 'Read only' },
]

export const integrations = [
  { id: 's3', name: 'Amazon S3', description: 'Export accepted datasets to an S3 bucket.', connected: true, detail: 's3://timefactories/datasets' },
  { id: 'gcs', name: 'Google Cloud Storage', description: 'Sync datasets to a GCS bucket.', connected: false },
  { id: 'hf', name: 'Hugging Face Hub', description: 'Publish datasets to a private HF organization.', connected: true, detail: 'timefactories (private)' },
  { id: 'slack', name: 'Slack', description: 'Mission and quality alerts in a channel.', connected: true, detail: '#robot-data' },
  { id: 'webhooks', name: 'Webhooks', description: 'Receive video.accepted and mission.completed events.', connected: false },
]
