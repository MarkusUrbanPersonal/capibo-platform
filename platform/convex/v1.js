import { internalMutation, internalQuery } from './_generated/server'
import { components } from './_generated/api'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { RateLimiter, SECOND } from '@convex-dev/rate-limiter'
import { missionStatus, videoStatus } from './schema'
import { redeemCode } from './billing'
import { createExport } from './exports'
import { apiError, invalid, notFound } from './lib/errors'
import { createMission, findDataset, findMission, updateMission } from './lib/missions'
import { randomId } from './lib/orgs'
import { computeEstimate } from './lib/pricing'
import {
  balanceJson, datasetJson, exportJson, missionJson, transactionJson, videoJson, webhookJson,
} from './lib/serialize'
import { dailyUsage, windowEnding } from './lib/usage'

// The REST API's data access, one internal function per endpoint. Requests are
// authenticated, validated and routed in lib/rest.js; every function here is
// scoped to the caller's organization.

const rateLimiter = new RateLimiter(components.rateLimiter, {
  // 100 requests per second per key, with bursts up to 200 (docs/api-reference/introduction.mdx).
  apiRequests: { kind: 'token bucket', rate: 100, period: SECOND, capacity: 200 },
})

const IDEMPOTENCY_TTL_MS = 86_400_000
const LAST_USED_RESOLUTION_MS = 60_000

const taskInput = v.object({
  name: v.string(),
  videos: v.number(),
  instructions: v.optional(v.string()),
  duration: v.optional(v.array(v.number())),
  labels: v.optional(v.array(v.string())),
})

/** Pages in the API's shape. Convex cursors are already opaque strings. */
function page(result, map) {
  return { data: result.page.map(map), has_more: !result.isDone, next_cursor: result.isDone ? null : result.continueCursor }
}

async function paginate(query, opts) {
  try {
    return await query.paginate(opts)
  } catch {
    throw invalid('cursor is invalid or expired. Start again without it.', 'cursor')
  }
}

// --- Auth -----------------------------------------------------------------

/** Looks up a key by its hash and spends one request from its rate limit. */
export const authenticate = internalMutation({
  args: { hash: v.string() },
  handler: async (ctx, { hash }) => {
    const key = await ctx.db
      .query('apiKeys')
      .withIndex('by_hash', (q) => q.eq('hash', hash))
      .unique()
    if (!key) return { error: 'invalid' }
    const { ok, retryAfter } = await rateLimiter.limit(ctx, 'apiRequests', { key: key._id })
    if (!ok) return { error: 'rate_limited', retryAfter }
    const now = Date.now()
    if (!key.lastUsedAt || now - key.lastUsedAt > LAST_USED_RESOLUTION_MS) await ctx.db.patch(key._id, { lastUsedAt: now })
    const org = await ctx.db.get(key.orgId)
    return { orgId: key.orgId, orgPublicId: org.publicId, scope: key.scope }
  },
})

// --- Idempotency ----------------------------------------------------------

async function replay(ctx, orgId, key, route) {
  if (!key) return null
  const row = await ctx.db
    .query('idempotencyKeys')
    .withIndex('by_org_and_key', (q) => q.eq('orgId', orgId).eq('key', key))
    .unique()
  if (!row) return null
  if (row.expiresAt < Date.now()) {
    await ctx.db.delete(row._id)
    return null
  }
  if (row.route !== route) {
    throw apiError(400, 'idempotency_key_reused', 'This Idempotency-Key was already used for a different request.', 'Idempotency-Key')
  }
  return { status: row.status, body: JSON.parse(row.body) }
}

async function remember(ctx, orgId, key, route, status, body) {
  if (key) {
    await ctx.db.insert('idempotencyKeys', {
      orgId,
      key,
      route,
      status,
      body: JSON.stringify(body),
      expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
    })
  }
  return { status, body }
}

// --- Missions -------------------------------------------------------------

export const listMissions = internalQuery({
  args: { orgId: v.id('organizations'), status: v.optional(missionStatus), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { orgId, status, paginationOpts }) => {
    const q = status
      ? ctx.db.query('missions').withIndex('by_org_and_status', (q) => q.eq('orgId', orgId).eq('status', status))
      : ctx.db.query('missions').withIndex('by_org', (q) => q.eq('orgId', orgId))
    const result = await paginate(q.order('desc').filter((q) => q.eq(q.field('deletedAt'), undefined)), paginationOpts)
    return page(result, missionJson)
  },
})

export const createMissionFromApi = internalMutation({
  args: {
    orgId: v.id('organizations'),
    idempotencyKey: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    regions: v.optional(v.array(v.string())),
    guidelines: v.optional(v.array(v.string())),
    tasks: v.array(taskInput),
    dispatch: v.boolean(),
  },
  handler: async (ctx, { orgId, idempotencyKey, ...input }) => {
    const route = 'POST /missions'
    const previous = await replay(ctx, orgId, idempotencyKey, route)
    if (previous) return previous
    const mission = await createMission(ctx, await ctx.db.get(orgId), { ...input, source: 'api' })
    return await remember(ctx, orgId, idempotencyKey, route, 201, missionJson(mission))
  },
})

export const estimate = internalQuery({
  args: { orgId: v.id('organizations'), tasks: v.array(taskInput) },
  handler: async (ctx, { orgId, tasks }) => {
    const org = await ctx.db.get(orgId)
    const e = computeEstimate(tasks.map((t) => ({ ...t, duration: t.duration ?? [10, 25] })))
    return {
      lines: e.lines,
      total_videos: e.totalVideos,
      accept_rate: e.acceptRate,
      expected_submissions: e.expectedSubmissions,
      collection: e.collection,
      processing: e.processing,
      total: e.total,
      avg_price: e.avgPrice,
      collectors: e.collectors,
      days: e.days,
      hours: e.hours,
      balance_covers: org.balance >= e.total,
    }
  },
})

export const getMission = internalQuery({
  args: { orgId: v.id('organizations'), ref: v.string() },
  handler: async (ctx, { orgId, ref }) => missionJson(await findMission(ctx, orgId, ref)),
})

export const updateMissionFromApi = internalMutation({
  args: {
    orgId: v.id('organizations'),
    ref: v.string(),
    status: v.optional(v.union(v.literal('active'), v.literal('paused'))),
    name: v.optional(v.string()),
    target: v.optional(v.number()),
  },
  handler: async (ctx, { orgId, ref, ...changes }) => {
    const mission = await findMission(ctx, orgId, ref)
    return missionJson(await updateMission(ctx, await ctx.db.get(orgId), mission, changes))
  },
})

export const missionStats = internalQuery({
  args: { orgId: v.id('organizations'), ref: v.string(), range: v.string(), today: v.string() },
  handler: async (ctx, { orgId, ref, range, today }) => {
    const m = await findMission(ctx, orgId, ref)
    const [from, to] = windowEnding(today, parseInt(range, 10))
    const rows = await dailyUsage(ctx, { orgId, missionId: m._id, from, to })
    const rate = (accepted, rejected) => (accepted + rejected ? Math.round((accepted / (accepted + rejected)) * 100) / 100 : null)
    return {
      mission_id: m.ref,
      range,
      acceptance_rate: rate(m.accepted, m.rejected),
      daily: rows.map((r) => ({ date: r.date, accepted: r.accepted, rejected: r.rejected, processing: r.submitted - r.accepted - r.rejected })),
      tasks: m.tasks.map((t) => ({
        task_id: t.id,
        name: t.name,
        share: m.submitted ? Math.round((t.submitted / m.submitted) * 100) / 100 : 0,
        acceptance_rate: rate(t.accepted, t.rejected),
        avg_duration: t.accepted ? Math.round(t.acceptedSeconds / t.accepted) : null,
      })),
    }
  },
})

// --- Datasets, videos and exports ------------------------------------------

export const listDatasets = internalQuery({
  args: { orgId: v.id('organizations'), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { orgId, paginationOpts }) => {
    const q = ctx.db
      .query('missions')
      .withIndex('by_org_and_datasetRef', (q) => q.eq('orgId', orgId).gte('datasetRef', ''))
      .order('desc')
    return page(await paginate(q, paginationOpts), datasetJson)
  },
})

export const getDataset = internalQuery({
  args: { orgId: v.id('organizations'), ref: v.string() },
  handler: async (ctx, { orgId, ref }) => datasetJson(await findDataset(ctx, orgId, ref)),
})

export const listDatasetVideos = internalQuery({
  args: {
    orgId: v.id('organizations'),
    ref: v.string(),
    status: videoStatus,
    taskId: v.optional(v.string()),
    createdAfter: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { orgId, ref, status, taskId, createdAfter, paginationOpts }) => {
    const mission = await findDataset(ctx, orgId, ref)
    let q = ctx.db
      .query('videos')
      .withIndex('by_mission_and_status', (q) => {
        const base = q.eq('missionId', mission._id).eq('status', status)
        return createdAfter === undefined ? base : base.gt('_creationTime', createdAfter)
      })
      .order('desc')
    if (taskId) q = q.filter((q) => q.eq(q.field('taskId'), taskId))
    const result = await paginate(q, paginationOpts)
    const data = await Promise.all(result.page.map((video) => videoJson(ctx, video, mission)))
    return { data, has_more: !result.isDone, next_cursor: result.isDone ? null : result.continueCursor }
  },
})

export const getVideo = internalQuery({
  args: { orgId: v.id('organizations'), ref: v.string() },
  handler: async (ctx, { orgId, ref }) => {
    const video = await ctx.db
      .query('videos')
      .withIndex('by_org_and_ref', (q) => q.eq('orgId', orgId).eq('ref', ref))
      .unique()
    if (!video) throw notFound('video', ref)
    return await videoJson(ctx, video, await ctx.db.get(video.missionId))
  },
})

export const createExportFromApi = internalMutation({
  args: {
    orgId: v.id('organizations'),
    ref: v.string(),
    idempotencyKey: v.optional(v.string()),
    format: v.string(),
    destination: v.string(),
    taskIds: v.optional(v.array(v.string())),
    createdAfter: v.optional(v.number()),
    includeRejected: v.optional(v.boolean()),
    blurFaces: v.optional(v.boolean()),
  },
  handler: async (ctx, { orgId, ref, idempotencyKey, ...input }) => {
    const route = `POST /datasets/${ref}/exports`
    const previous = await replay(ctx, orgId, idempotencyKey, route)
    if (previous) return previous
    const mission = await findDataset(ctx, orgId, ref)
    const job = await createExport(ctx, await ctx.db.get(orgId), mission, input)
    return await remember(ctx, orgId, idempotencyKey, route, 202, exportJson(job, mission))
  },
})

export const getExport = internalQuery({
  args: { orgId: v.id('organizations'), ref: v.string() },
  handler: async (ctx, { orgId, ref }) => {
    const job = await ctx.db
      .query('exports')
      .withIndex('by_org_and_ref', (q) => q.eq('orgId', orgId).eq('ref', ref))
      .unique()
    if (!job) throw notFound('export', ref)
    return exportJson(job, await ctx.db.get(job.missionId))
  },
})

// --- Billing and usage ----------------------------------------------------

export const getBalance = internalQuery({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, { orgId }) => balanceJson(await ctx.db.get(orgId)),
})

export const listTransactions = internalQuery({
  args: { orgId: v.id('organizations'), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { orgId, paginationOpts }) => {
    const q = ctx.db
      .query('transactions')
      .withIndex('by_org', (q) => q.eq('orgId', orgId))
      .order('desc')
    return page(await paginate(q, paginationOpts), transactionJson)
  },
})

export const redeemPromo = internalMutation({
  args: { orgId: v.id('organizations'), code: v.string() },
  handler: async (ctx, { orgId, code }) => {
    const { transaction } = await redeemCode(ctx, await ctx.db.get(orgId), code)
    const org = await ctx.db.get(orgId)
    return { transaction: transactionJson(transaction), balance: org.balance }
  },
})

export const getUsage = internalQuery({
  args: { orgId: v.id('organizations'), from: v.string(), to: v.string(), missionRef: v.optional(v.string()) },
  handler: async (ctx, { orgId, from, to, missionRef }) => {
    const mission = missionRef ? await findMission(ctx, orgId, missionRef) : null
    const rows = await dailyUsage(ctx, { orgId, missionId: mission?._id, from, to })
    const totals = rows.reduce(
      (t, r) => ({ submitted: t.submitted + r.submitted, accepted: t.accepted + r.accepted, cost: t.cost + r.cost }),
      { submitted: 0, accepted: 0, cost: 0 },
    )
    return {
      from,
      to,
      mission_id: mission?.ref ?? null,
      totals: { ...totals, cost: Math.round(totals.cost * 100) / 100 },
      daily: rows.map(({ date, submitted, accepted, cost }) => ({ date, submitted, accepted, cost })),
    }
  },
})

// --- Webhooks -------------------------------------------------------------

export const listWebhooks = internalQuery({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, { orgId }) => {
    const endpoints = await ctx.db
      .query('webhooks')
      .withIndex('by_org', (q) => q.eq('orgId', orgId))
      .order('desc')
      .take(100)
    return { data: endpoints.map(webhookJson) }
  },
})

export const createWebhook = internalMutation({
  args: { orgId: v.id('organizations'), url: v.string(), events: v.array(v.string()), secret: v.string() },
  handler: async (ctx, { orgId, url, events, secret }) => {
    const existing = await ctx.db
      .query('webhooks')
      .withIndex('by_org', (q) => q.eq('orgId', orgId))
      .take(100)
    if (existing.length >= 20) throw invalid('An organization can have at most 20 webhook endpoints.', 'url')
    let ref
    do ref = `wh_${randomId(6).toLowerCase()}`
    while (existing.some((w) => w.ref === ref))
    const id = await ctx.db.insert('webhooks', { orgId, ref, url, events, secret })
    return { ...webhookJson(await ctx.db.get(id)), secret }
  },
})

export const deleteWebhook = internalMutation({
  args: { orgId: v.id('organizations'), ref: v.string() },
  handler: async (ctx, { orgId, ref }) => {
    const endpoint = await ctx.db
      .query('webhooks')
      .withIndex('by_org_and_ref', (q) => q.eq('orgId', orgId).eq('ref', ref))
      .unique()
    if (!endpoint) throw notFound('webhook endpoint', ref)
    await ctx.db.delete(endpoint._id)
  },
})
