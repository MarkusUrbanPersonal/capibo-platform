// Mission pricing, shared by Convex functions and the platform's mission planner
// (imported there as '@convex/lib/pricing') so both always quote the same numbers.

// QA processing fee per submitted video, accepted or not.
export const PROCESSING_FEE = 0.15
// Expected share of submissions that pass QA, from similar missions.
export const ACCEPT_RATE = 0.85
export const DEFAULT_DURATION = [10, 25]

const round2 = (n) => Math.round(n * 100) / 100

/** USD per accepted video; longer clips cost more. */
export function priceFor(duration) {
  const avg = (duration[0] + duration[1]) / 2
  return round2(1.4 + avg * 0.055)
}

/**
 * Prices a set of tasks ({ name, videos, duration, price? }). Matches the
 * `Estimate` schema in the API docs, in camelCase.
 */
export function computeEstimate(tasks) {
  const lines = tasks.map((t) => {
    const price = t.price ?? priceFor(t.duration)
    return { name: t.name, videos: t.videos, price, subtotal: round2(t.videos * price) }
  })
  const footageSeconds = tasks.reduce((s, t) => s + t.videos * ((t.duration[0] + t.duration[1]) / 2), 0)
  const totalVideos = lines.reduce((s, l) => s + l.videos, 0)
  const collection = round2(lines.reduce((s, l) => s + l.subtotal, 0))
  const expectedSubmissions = Math.round(totalVideos / ACCEPT_RATE)
  const processing = round2(expectedSubmissions * PROCESSING_FEE)
  const collectors = Math.max(60, Math.round(totalVideos / 9.5))
  return {
    lines,
    totalVideos,
    expectedSubmissions,
    acceptRate: ACCEPT_RATE,
    collection,
    processing,
    total: round2(collection + processing),
    avgPrice: round2(collection / Math.max(1, totalVideos)),
    collectors,
    days: Math.max(3, Math.ceil(expectedSubmissions / (collectors * 1.1))),
    hours: Math.round((footageSeconds / 3600) * 10) / 10,
  }
}
