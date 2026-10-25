import { ConvexError } from 'convex/values'
import { httpAction } from '../_generated/server'
import { internal } from '../_generated/api'
import { sha256Hex } from './crypto'
import { apiError, invalid, missing } from './errors'
import { REGIONS } from './missions'
import { compact, errorResponse, json, readJson } from './rest'
import { int, isObject, oneOf, str } from './validate'

// The collector app's API, served under /collector/v1/ by
// http.js. The app lists open missions, uploads clips to Convex storage, submits
// them, and reports its own accept/reject verdicts; collection.js does the rest.

function num(x, param, { min = 0, max = Infinity } = {}) {
  if (x === undefined || x === null) throw missing(param)
  if (typeof x !== 'number' || !Number.isFinite(x)) throw invalid(`${param} must be a number.`, param)
  if (x <= min || x > max) throw invalid(`${param} must be greater than ${min} and at most ${max}.`, param)
  return x
}

function requiredBool(x, param) {
  if (x === undefined || x === null) throw missing(param)
  if (typeof x !== 'boolean') throw invalid(`${param} must be true or false.`, param)
  return x
}

async function uploadedFile(ctx, id, param) {
  const file = await ctx.runQuery(internal.collector.storedFile, { id })
  if (!file) throw invalid(`${param} isn't an uploaded file. Upload it through POST /collector/v1/uploads first.`, param)
  return file
}

async function submitVideo(ctx, { req }) {
  const body = await readJson(req)
  const mission = await ctx.runQuery(internal.collector.getMission, { id: str(body.mission_id, 'mission_id', { required: true }) })
  const taskId = oneOf(body.task_id, 'task_id', mission.tasks.map((t) => t.id), { required: true })
  const region = oneOf(body.region, 'region', mission.regions, { required: true })
  const video = await uploadedFile(ctx, str(body.video_storage_id, 'video_storage_id', { required: true }), 'video_storage_id')
  const annotationsId = str(body.annotations_storage_id, 'annotations_storage_id')
  const annotations = annotationsId ? await uploadedFile(ctx, annotationsId, 'annotations_storage_id') : undefined
  await ctx.runMutation(internal.collection.submitVideo, compact({
    missionId: mission.id,
    taskId,
    duration: num(body.duration, 'duration', { max: 3600 }),
    resolution: str(body.resolution, 'resolution', { required: true, max: 20 }),
    fps: num(body.fps, 'fps', { max: 240 }),
    sizeMb: video.sizeMb,
    device: str(body.device, 'device', { required: true, max: 120 }),
    collectorId: str(body.collector_id, 'collector_id', { required: true, max: 120 }),
    region,
    fileId: video.fileId,
    annotationsFileId: annotations?.fileId,
  }))
  return { status: 201, body: await ctx.runQuery(internal.collector.getVideoByFile, { fileId: video.fileId }) }
}

async function reviewVideo(ctx, { params: [id], req }) {
  const body = await readJson(req)
  const video = await ctx.runQuery(internal.collector.getVideo, { id })
  const accepted = requiredBool(body.accepted, 'accepted')
  if (!isObject(body.checks)) throw body.checks === undefined ? missing('checks') : invalid('checks must be an object.', 'checks')
  const c = body.checks
  await ctx.runMutation(internal.collection.reviewVideo, compact({
    videoId: video.id,
    accepted,
    quality: int(body.quality, 'quality', { required: true, min: 0, max: 100 }),
    rejectionReason: accepted ? undefined : str(body.rejection_reason, 'rejection_reason', { max: 300 }),
    checks: {
      handsInFrame: requiredBool(c.hands_in_frame, 'checks.hands_in_frame'),
      lighting: int(c.lighting, 'checks.lighting', { required: true, min: 0, max: 100 }),
      blur: int(c.blur, 'checks.blur', { required: true, min: 0, max: 100 }),
      taskComplete: requiredBool(c.task_complete, 'checks.task_complete'),
      privacy: requiredBool(c.privacy, 'checks.privacy'),
    },
  }))
  return { body: await ctx.runQuery(internal.collector.getVideo, { id }) }
}

// Each route: [method, path pattern, handler(ctx, { params, query, req }) → { status?, body }].
const ROUTES = [
  ['GET', /^\/missions$/, async (ctx, { query }) => ({
    body: {
      data: await ctx.runQuery(internal.collector.listOpenMissions, compact({
        region: oneOf(query.get('region') || undefined, 'region', REGIONS),
      })),
    },
  })],
  ['GET', /^\/missions\/([^/]+)$/, async (ctx, { params: [id] }) => ({
    body: await ctx.runQuery(internal.collector.getMission, { id }),
  })],
  ['POST', /^\/uploads$/, async (ctx) => ({ body: { upload_url: await ctx.storage.generateUploadUrl() } })],
  ['POST', /^\/videos$/, submitVideo],
  ['GET', /^\/videos\/([^/]+)$/, async (ctx, { params: [id] }) => ({
    body: await ctx.runQuery(internal.collector.getVideo, { id }),
  })],
  ['POST', /^\/videos\/([^/]+)\/review$/, reviewVideo],
]

async function authenticate(req) {
  const secret = process.env.COLLECTOR_API_SECRET
  if (!secret) throw apiError(503, 'collector_api_disabled', 'The collector API is off: COLLECTOR_API_SECRET is not set on this deployment.')
  const match = (req.headers.get('Authorization') ?? '').match(/^Bearer\s+(\S+)\s*$/i)
  // Comparing hashes keeps the comparison time independent of the secret.
  if (!match || (await sha256Hex(match[1])) !== (await sha256Hex(secret))) {
    throw apiError(401, 'collector_key_invalid', 'Missing or invalid collector key. Send it as "Authorization: Bearer <COLLECTOR_API_SECRET>".')
  }
}

export const handleCollector = httpAction(async (ctx, req) => {
  try {
    await authenticate(req)
    const url = new URL(req.url)
    const path = url.pathname.replace(/^\/collector\/v1/, '').replace(/\/+$/, '') || '/'
    for (const [method, pattern, handler] of ROUTES) {
      const m = method === req.method && path.match(pattern)
      if (!m) continue
      const { status = 200, body } = await handler(ctx, { params: m.slice(1).map(decodeURIComponent), query: url.searchParams, req })
      return json(status, body)
    }
    throw apiError(404, 'route_missing', `There's no ${req.method} /collector/v1${path} endpoint.`)
  } catch (e) {
    // collection.js throws plain-message ConvexErrors for state conflicts
    // (mission not collecting, video already reviewed).
    if (e instanceof ConvexError && typeof e.data === 'string') {
      return json(409, { error: { type: 'conflict', code: 'invalid_state', message: e.data } })
    }
    return errorResponse(e)
  }
})
