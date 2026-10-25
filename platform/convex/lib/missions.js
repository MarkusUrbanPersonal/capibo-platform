import { internal } from '../_generated/api'
import { apiError, invalid, notFound } from './errors'
import { emitEvent } from './events'
import { computeEstimate, DEFAULT_DURATION, priceFor } from './pricing'
import { missionJson } from './serialize'
import { int, isObject, str, strArray } from './validate'
import { isIcon, isTone } from './visuals'

// Mission rules shared by the platform (missions.js) and the REST API (v1.js).

export const REGIONS = ['US', 'CA', 'MX', 'BR', 'UK', 'DE', 'ES', 'PT', 'PL', 'IN']
export const DEFAULT_REGIONS = ['US']
// How long "dispatching" lasts before collectors are considered notified.
const DISPATCH_DELAY_MS = 10_000
const MAX_TASKS = 50

const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** Validates task input (from JSON or the platform) into { name, videos, instructions?, duration?, labels? }. */
export function parseTasks(raw, param = 'tasks') {
  if (!Array.isArray(raw) || raw.length === 0) throw invalid(`${param} must be a non-empty array.`, param)
  if (raw.length > MAX_TASKS) throw invalid(`${param} can have at most ${MAX_TASKS} tasks.`, param)
  return raw.map((t, i) => {
    const p = `${param}[${i}]`
    if (!isObject(t)) throw invalid(`${p} must be an object.`, p)
    let duration
    if (t.duration !== undefined && t.duration !== null) {
      if (!Array.isArray(t.duration) || t.duration.length !== 2) {
        throw invalid(`${p}.duration must be [min, max] in seconds.`, `${p}.duration`)
      }
      duration = t.duration.map((s, j) => int(s, `${p}.duration[${j}]`, { required: true, min: 1, max: 600 }))
      if (duration[0] > duration[1]) throw invalid(`${p}.duration min can't be greater than max.`, `${p}.duration`)
    }
    return {
      name: str(t.name, `${p}.name`, { required: true, max: 120 }),
      videos: int(t.videos, `${p}.videos`, { required: true, min: 1, max: 1_000_000 }),
      instructions: str(t.instructions, `${p}.instructions`, { max: 2000 }),
      duration,
      labels: strArray(t.labels, `${p}.labels`, { maxItems: 30, max: 60 }),
      // Optional display hints; unknown values are dropped rather than rejected.
      icon: isIcon(t.icon) ? t.icon : undefined,
      tone: isTone(t.tone) ? t.tone : undefined,
    }
  })
}

/** Parsed tasks → stored tasks: generated defaults, server-side price, zeroed counters. */
export function buildTasks(tasks) {
  return tasks.map((t, i) => {
    const duration = t.duration ?? DEFAULT_DURATION
    return {
      id: `T-${i + 1}`,
      name: t.name,
      instructions: t.instructions || `Perform “${t.name}” end to end at a natural pace.`,
      videos: t.videos,
      duration,
      labels: t.labels ?? [],
      ...(t.icon ? { icon: t.icon } : {}),
      ...(t.tone ? { tone: t.tone } : {}),
      price: priceFor(duration),
      submitted: 0,
      accepted: 0,
      rejected: 0,
      acceptedSeconds: 0,
    }
  })
}

/** Throws 402 unless the balance covers the estimated cost of collecting `tasks`. */
function ensureCovered(org, tasks) {
  const { total } = computeEstimate(tasks)
  if (total > org.balance) {
    throw apiError(402, 'insufficient_credits', `Estimated cost ${usd(total)} exceeds your balance of ${usd(org.balance)}.`)
  }
}

async function dispatch(ctx, missionId) {
  await ctx.db.patch(missionId, { status: 'dispatching', startedAt: Date.now() })
  await ctx.scheduler.runAfter(DISPATCH_DELAY_MS, internal.missions.finishDispatch, { missionId })
}

/**
 * Creates a mission from parsed input. With `dispatch`, it checks the balance
 * and starts dispatching; otherwise it stays a draft.
 */
export async function createMission(ctx, org, { name, description, regions, guidelines, icon, tone, tasks, dispatch: send, source, userId }) {
  const built = buildTasks(tasks)
  if (send) ensureCovered(org, built)
  const seq = org.seq ?? { mission: 1000, dataset: 300 }
  await ctx.db.patch(org._id, { seq: { ...seq, mission: seq.mission + 1 } })
  const missionId = await ctx.db.insert('missions', {
    orgId: org._id,
    ref: `MSN-${seq.mission + 1}`,
    name,
    description: description ?? '',
    status: 'draft',
    regions: regions?.length ? regions : DEFAULT_REGIONS,
    guidelines: guidelines ?? [],
    ...(isIcon(icon) ? { icon } : {}),
    ...(isTone(tone) ? { tone } : {}),
    tasks: built,
    target: built.reduce((s, t) => s + t.videos, 0),
    submitted: 0,
    accepted: 0,
    rejected: 0,
    cost: 0,
    acceptedSeconds: 0,
    qualitySum: 0,
    source,
    createdBy: userId,
  })
  if (send) await dispatch(ctx, missionId)
  return await ctx.db.get(missionId)
}

/** Applies a status / name / target change, enforcing the mission lifecycle. */
export async function updateMission(ctx, org, mission, { status, name, target }) {
  if (status !== undefined && status !== mission.status) {
    if (mission.status === 'completed') {
      throw apiError(409, 'mission_completed', `${mission.ref} is completed, so it can't be paused or resumed.`)
    }
    if (status === 'paused') {
      if (mission.status === 'draft') throw apiError(409, 'mission_draft', `${mission.ref} is a draft. Set status to active to launch it.`)
      await ctx.db.patch(mission._id, { status: 'paused' })
    } else if (mission.status === 'draft') {
      ensureCovered(org, mission.tasks)
      await dispatch(ctx, mission._id)
    } else if (mission.status === 'paused') {
      await ctx.db.patch(mission._id, { status: 'active' })
    }
  }
  if (name !== undefined) await ctx.db.patch(mission._id, { name })
  if (target !== undefined) {
    if (target < mission.accepted) {
      throw invalid(`target can't be lower than the ${mission.accepted} videos already accepted.`, 'target')
    }
    await ctx.db.patch(mission._id, { target })
  }
  const updated = await ctx.db.get(mission._id)
  return await completeIfDone(ctx, updated)
}

/** Completes a running mission that has reached its target, firing `mission.completed`. */
export async function completeIfDone(ctx, mission) {
  const running = mission.status === 'active' || mission.status === 'paused' || mission.status === 'dispatching'
  if (!running || mission.accepted < mission.target) return mission
  await ctx.db.patch(mission._id, {
    status: 'completed',
    completedAt: Date.now(),
    ...(mission.datasetRef ? { datasetVersion: 'v2.0' } : {}),
  })
  const done = await ctx.db.get(mission._id)
  await emitEvent(ctx, mission.orgId, 'mission.completed', missionJson(done))
  return done
}

/** The organization's mission with this MSN- reference, or a 404. Deleted missions count as missing. */
export async function findMission(ctx, orgId, ref) {
  const m = await ctx.db
    .query('missions')
    .withIndex('by_org_and_ref', (q) => q.eq('orgId', orgId).eq('ref', ref))
    .unique()
  if (!m || m.deletedAt) throw notFound('mission', ref)
  return m
}

/** The mission behind a DS- dataset reference, or a 404. Datasets outlive deleted missions. */
export async function findDataset(ctx, orgId, ref) {
  const m = await ctx.db
    .query('missions')
    .withIndex('by_org_and_datasetRef', (q) => q.eq('orgId', orgId).eq('datasetRef', ref))
    .unique()
  if (!m) throw notFound('dataset', ref)
  return m
}
