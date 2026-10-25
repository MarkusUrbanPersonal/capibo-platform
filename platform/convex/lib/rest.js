import { httpAction } from '../_generated/server'
import { internal } from '../_generated/api'
import { EVENT_TYPES } from '../schema'
import { DESTINATIONS, FORMATS } from '../exports'
import { randomHex, sha256Hex } from './crypto'
import { apiError, invalid, missing } from './errors'
import { parseTasks, REGIONS } from './missions'
import { DATE_RE, daysBetween, isoDay } from './usage'
import { bool, dateTime, int, isObject, oneOf, str, strArray } from './validate'

// The public REST API (docs/openapi.yaml), served under /v1/ by http.js.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key, Capibo-Organization',
  'Access-Control-Expose-Headers': 'Retry-After',
  'Access-Control-Max-Age': '86400',
}

// Which key scopes may call each kind of endpoint (docs/authentication.mdx#scopes).
const SCOPES = {
  datasets: ['Read datasets', 'Read only', 'Full access'],
  read: ['Read only', 'Full access'],
  write: ['Full access'],
}

const MISSION_STATUSES = ['draft', 'dispatching', 'active', 'paused', 'completed']
const VIDEO_STATUSES = ['processing', 'accepted', 'rejected']
const MAX_USAGE_DAYS = 366

export function json(status, body, headers = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { ...CORS, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
  })
}

export async function readJson(req) {
  const text = await req.text()
  if (!text.trim()) return {}
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw apiError(400, 'invalid_json', 'The request body must be valid JSON.')
  }
  if (!isObject(body)) throw apiError(400, 'invalid_json', 'The request body must be a JSON object.')
  return body
}

function pagination(query) {
  const raw = query.get('limit')
  const limit = raw === null ? 25 : Number(raw)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid('limit must be an integer from 1 to 100.', 'limit')
  return { numItems: limit, cursor: query.get('cursor') || null }
}

function idempotencyKey(req) {
  const key = req.headers.get('Idempotency-Key')?.trim()
  if (key && key.length > 255) throw invalid('Idempotency-Key must be at most 255 characters.', 'Idempotency-Key')
  return key || undefined
}

/** Drops undefined fields, which Convex function arguments can't carry. */
export const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined))

const today = () => isoDay(Date.now())

// Each route: [method, path pattern, scope kind, handler(ctx, { orgId, params, query, req }) → { status?, body }].
const ROUTES = [
  ['GET', /^\/missions$/, 'read', async (ctx, { orgId, query }) => ({
    body: await ctx.runQuery(internal.v1.listMissions, compact({
      orgId,
      status: oneOf(query.get('status') || undefined, 'status', MISSION_STATUSES),
      paginationOpts: pagination(query),
    })),
  })],

  ['POST', /^\/missions$/, 'write', async (ctx, { orgId, req }) => {
    const body = await readJson(req)
    const name = str(body.name, 'name', { required: true, max: 120 })
    if (body.tasks === undefined) throw missing('tasks')
    return await ctx.runMutation(internal.v1.createMissionFromApi, compact({
      orgId,
      idempotencyKey: idempotencyKey(req),
      name,
      description: str(body.description, 'description', { max: 2000 }),
      regions: strArray(body.regions, 'regions', { values: REGIONS, maxItems: REGIONS.length }),
      guidelines: strArray(body.guidelines, 'guidelines', { maxItems: 20, max: 300 }),
      tasks: parseTasks(body.tasks).map(compact),
      dispatch: bool(body.dispatch, 'dispatch') ?? true,
    }))
  }],

  ['POST', /^\/missions\/estimate$/, 'read', async (ctx, { orgId, req }) => {
    const body = await readJson(req)
    if (body.tasks === undefined) throw missing('tasks')
    strArray(body.regions, 'regions', { values: REGIONS, maxItems: REGIONS.length })
    return { body: await ctx.runQuery(internal.v1.estimate, { orgId, tasks: parseTasks(body.tasks).map(compact) }) }
  }],

  ['GET', /^\/missions\/([^/]+)$/, 'read', async (ctx, { orgId, params: [ref] }) => ({
    body: await ctx.runQuery(internal.v1.getMission, { orgId, ref }),
  })],

  ['PATCH', /^\/missions\/([^/]+)$/, 'write', async (ctx, { orgId, params: [ref], req }) => {
    const body = await readJson(req)
    const changes = compact({
      status: oneOf(body.status, 'status', ['active', 'paused']),
      name: str(body.name, 'name', { max: 120 }),
      target: int(body.target, 'target', { min: 1, max: 100_000_000 }),
    })
    if (changes.name === '') throw invalid("name can't be empty.", 'name')
    if (!Object.keys(changes).length) throw invalid('Send at least one of status, name or target.')
    return { body: await ctx.runMutation(internal.v1.updateMissionFromApi, { orgId, ref, ...changes }) }
  }],

  ['GET', /^\/missions\/([^/]+)\/stats$/, 'read', async (ctx, { orgId, params: [ref], query }) => ({
    body: await ctx.runQuery(internal.v1.missionStats, {
      orgId,
      ref,
      range: oneOf(query.get('range') || '30d', 'range', ['7d', '30d', '90d']),
      today: today(),
    }),
  })],

  ['GET', /^\/datasets$/, 'datasets', async (ctx, { orgId, query }) => ({
    body: await ctx.runQuery(internal.v1.listDatasets, { orgId, paginationOpts: pagination(query) }),
  })],

  ['GET', /^\/datasets\/([^/]+)$/, 'datasets', async (ctx, { orgId, params: [ref] }) => ({
    body: await ctx.runQuery(internal.v1.getDataset, { orgId, ref }),
  })],

  ['GET', /^\/datasets\/([^/]+)\/videos$/, 'datasets', async (ctx, { orgId, params: [ref], query }) => ({
    body: await ctx.runQuery(internal.v1.listDatasetVideos, compact({
      orgId,
      ref,
      status: oneOf(query.get('status') || 'accepted', 'status', VIDEO_STATUSES),
      taskId: query.get('task_id') || undefined,
      createdAfter: dateTime(query.get('created_after'), 'created_after'),
      paginationOpts: pagination(query),
    })),
  })],

  ['POST', /^\/datasets\/([^/]+)\/exports$/, 'write', async (ctx, { orgId, params: [ref], req }) => {
    const body = await readJson(req)
    return await ctx.runMutation(internal.v1.createExportFromApi, compact({
      orgId,
      ref,
      idempotencyKey: idempotencyKey(req),
      format: oneOf(body.format, 'format', FORMATS, { required: true }),
      destination: oneOf(body.destination, 'destination', DESTINATIONS, { required: true }),
      taskIds: strArray(body.task_ids, 'task_ids', { max: 20 }),
      createdAfter: dateTime(body.created_after, 'created_after'),
      includeRejected: bool(body.include_rejected, 'include_rejected'),
      blurFaces: bool(body.blur_faces, 'blur_faces'),
    }))
  }],

  ['GET', /^\/videos\/([^/]+)$/, 'datasets', async (ctx, { orgId, params: [ref] }) => ({
    body: await ctx.runQuery(internal.v1.getVideo, { orgId, ref }),
  })],

  ['GET', /^\/exports\/([^/]+)$/, 'datasets', async (ctx, { orgId, params: [ref] }) => ({
    body: await ctx.runQuery(internal.v1.getExport, { orgId, ref }),
  })],

  ['GET', /^\/billing\/balance$/, 'read', async (ctx, { orgId }) => ({
    body: await ctx.runQuery(internal.v1.getBalance, { orgId }),
  })],

  ['GET', /^\/billing\/transactions$/, 'read', async (ctx, { orgId, query }) => ({
    body: await ctx.runQuery(internal.v1.listTransactions, { orgId, paginationOpts: pagination(query) }),
  })],

  ['POST', /^\/billing\/promo-codes\/redeem$/, 'write', async (ctx, { orgId, req }) => {
    const body = await readJson(req)
    const code = str(body.code, 'code', { required: true, max: 64 })
    return { body: await ctx.runMutation(internal.v1.redeemPromo, { orgId, code }) }
  }],

  ['GET', /^\/usage$/, 'read', async (ctx, { orgId, query }) => {
    const from = query.get('from')
    const to = query.get('to')
    for (const [param, value] of [['from', from], ['to', to]]) {
      if (!value) throw missing(param)
      if (!DATE_RE.test(value) || Number.isNaN(Date.parse(value))) throw invalid(`${param} must be a date like 2026-10-01.`, param)
    }
    if (from > to) throw invalid("from can't be after to.", 'from')
    if (daysBetween(from, to).length > MAX_USAGE_DAYS) throw invalid(`The period can be at most ${MAX_USAGE_DAYS} days.`, 'to')
    return {
      body: await ctx.runQuery(internal.v1.getUsage, compact({ orgId, from, to, missionRef: query.get('mission_id') || undefined })),
    }
  }],

  ['GET', /^\/webhooks$/, 'read', async (ctx, { orgId }) => ({
    body: await ctx.runQuery(internal.v1.listWebhooks, { orgId }),
  })],

  ['POST', /^\/webhooks$/, 'write', async (ctx, { orgId, req }) => {
    const body = await readJson(req)
    const url = str(body.url, 'url', { required: true, max: 2000 })
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      throw invalid('url must be a valid URL.', 'url')
    }
    if (parsed.protocol !== 'https:') throw invalid('url must use https.', 'url')
    if (body.events === undefined) throw missing('events')
    const events = [...new Set(strArray(body.events, 'events', { values: EVENT_TYPES }))]
    if (!events.length) throw invalid('events must list at least one event type.', 'events')
    const body201 = await ctx.runMutation(internal.v1.createWebhook, { orgId, url, events, secret: `whsec_${randomHex(24)}` })
    return { status: 201, body: body201 }
  }],

  ['DELETE', /^\/webhooks\/([^/]+)$/, 'write', async (ctx, { orgId, params: [ref] }) => {
    await ctx.runMutation(internal.v1.deleteWebhook, { orgId, ref })
    return { status: 204 }
  }],
]

async function authenticate(ctx, req, kind) {
  const match = (req.headers.get('Authorization') ?? '').match(/^Bearer\s+(\S+)\s*$/i)
  if (!match) {
    throw apiError(401, 'api_key_invalid', 'Missing API key. Send it as "Authorization: Bearer cpb_live_…".')
  }
  const result = await ctx.runMutation(internal.v1.authenticate, { hash: await sha256Hex(match[1]) })
  if (result.error === 'invalid') throw apiError(401, 'api_key_invalid', 'Invalid API key.')
  if (result.error === 'rate_limited') {
    const err = apiError(429, 'rate_limited', 'Too many requests for this API key. Retry after the Retry-After delay.')
    err.data.retryAfter = Math.max(1, Math.ceil((result.retryAfter ?? 1000) / 1000))
    throw err
  }
  const orgHeader = req.headers.get('Capibo-Organization')
  if (orgHeader && orgHeader !== result.orgPublicId) {
    throw apiError(403, 'organization_mismatch', "This API key doesn't belong to the organization in the Capibo-Organization header.")
  }
  if (!SCOPES[kind].includes(result.scope)) {
    throw apiError(403, 'scope_insufficient', `This endpoint needs a ${kind === 'write' ? 'Full access' : 'Read only or Full access'} key; this key is ${result.scope}.`)
  }
  return result.orgId
}

export function errorResponse(e) {
  const data = e?.data
  if (data && typeof data === 'object' && typeof data.status === 'number') {
    const { status, retryAfter, ...error } = data
    return json(status, { error }, retryAfter ? { 'Retry-After': String(retryAfter) } : {})
  }
  console.error(e)
  return json(500, {
    error: { type: 'api_error', code: 'internal_error', message: 'Something went wrong on our side. Retry with exponential backoff.' },
  })
}

export const handleV1 = httpAction(async (ctx, req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  try {
    const url = new URL(req.url)
    const path = url.pathname.replace(/^\/v1/, '').replace(/\/+$/, '') || '/'
    // Unauthenticated health check, so you can see the API is up from a browser.
    if (path === '/' && req.method === 'GET') {
      return json(200, {
        message: 'Welcome to the Capibo API. Send requests with an API key: "Authorization: Bearer cpb_live_…".',
        status: 'ok',
        version: 'v1',
        docs: 'https://docs.capibo.work/api-reference/introduction',
      })
    }
    let route
    let params
    for (const r of ROUTES) {
      const m = r[0] === req.method && path.match(r[1])
      if (m) {
        route = r
        params = m.slice(1).map(decodeURIComponent)
        break
      }
    }
    if (!route) throw apiError(404, 'route_missing', `There's no ${req.method} /v1${path} endpoint. See https://docs.capibo.work/api-reference/introduction.`)
    const orgId = await authenticate(ctx, req, route[2])
    const { status = 200, body } = await route[3](ctx, { orgId, params, query: url.searchParams, req })
    return json(status, body)
  } catch (e) {
    return errorResponse(e)
  }
})
