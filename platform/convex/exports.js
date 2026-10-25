import { internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { apiError, invalid } from './lib/errors'
import { emitEvent } from './lib/events'
import { findDataset } from './lib/missions'
import { CAN, requireMember } from './lib/orgs'
import { datasetJson, exportJson, iso, videoJson } from './lib/serialize'

export const FORMATS = ['lerobot', 'rlds', 'webdataset', 'mp4-json']
export const DESTINATIONS = ['s3', 'gcs', 'hf', 'link']
const INTEGRATION = { s3: 'Amazon S3', gcs: 'Google Cloud Storage', hf: 'Hugging Face' }
const MAX_VIDEOS = 50_000

async function uniqueExportRef(ctx, orgId) {
  for (;;) {
    const ref = `EXP-${Math.floor(10_000 + Math.random() * 90_000)}`
    const taken = await ctx.db
      .query('exports')
      .withIndex('by_org_and_ref', (q) => q.eq('orgId', orgId).eq('ref', ref))
      .unique()
    if (!taken) return ref
  }
}

/**
 * Queues an export of a dataset. Only `link` delivery works today: storage
 * integrations (S3, GCS, Hugging Face) can't be connected yet.
 */
export async function createExport(ctx, org, mission, { format, destination, taskIds, createdAfter, includeRejected, blurFaces }) {
  if (destination !== 'link') {
    throw apiError(
      400,
      'destination_not_connected',
      `No ${INTEGRATION[destination]} integration is connected to this organization. Use "link" for a download link.`,
      'destination',
    )
  }
  for (const id of taskIds ?? []) {
    if (!mission.tasks.some((t) => t.id === id)) throw invalid(`task_ids contains ${id}, which isn't a task of ${mission.ref}.`, 'task_ids')
  }
  const exportId = await ctx.db.insert('exports', {
    orgId: org._id,
    missionId: mission._id,
    ref: await uniqueExportRef(ctx, org._id),
    status: 'queued',
    format,
    destination,
    taskIds: taskIds?.length ? taskIds : null,
    createdAfter: createdAfter ?? null,
    includeRejected: includeRejected ?? false,
    blurFaces: blurFaces ?? true,
    videos: 0,
  })
  await ctx.scheduler.runAfter(0, internal.exports.pack, { exportId })
  return await ctx.db.get(exportId)
}

// --- Platform -------------------------------------------------------------

export const create = mutation({
  args: {
    datasetId: v.string(),
    format: v.string(),
    destination: v.string(),
    includeRejected: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { org } = await requireMember(ctx, CAN.manageMissions)
    if (!FORMATS.includes(args.format)) throw invalid('Unknown export format.', 'format')
    if (!DESTINATIONS.includes(args.destination)) throw invalid('Unknown destination.', 'destination')
    const mission = await findDataset(ctx, org._id, args.datasetId)
    const job = await createExport(ctx, org, mission, args)
    return job.ref
  },
})

export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const { org } = await requireMember(ctx)
    const job = await ctx.db
      .query('exports')
      .withIndex('by_org_and_ref', (q) => q.eq('orgId', org._id).eq('ref', id))
      .unique()
    if (!job) return null
    return { ...exportJson(job, await ctx.db.get(job.missionId)) }
  },
})

// --- Packaging --------------------------------------------------------------

/** Writes a JSON manifest (metadata, QA results and file links per video) to file storage. */
export const pack = internalAction({
  args: { exportId: v.id('exports') },
  handler: async (ctx, { exportId }) => {
    const job = await ctx.runMutation(internal.exports.start, { exportId })
    if (!job) return
    try {
      const videos = []
      for (const status of job.includeRejected ? ['accepted', 'rejected'] : ['accepted']) {
        let cursor = null
        do {
          const page = await ctx.runQuery(internal.exports.videoPage, {
            exportId,
            status,
            paginationOpts: { numItems: 200, cursor },
          })
          videos.push(...page.videos)
          cursor = page.isDone ? null : page.cursor
        } while (cursor && videos.length < MAX_VIDEOS)
      }
      const manifest = {
        export_id: job.ref,
        format: job.format,
        dataset: job.dataset,
        created_at: job.createdAt,
        videos: videos.slice(0, MAX_VIDEOS),
      }
      const fileId = await ctx.storage.store(new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }))
      await ctx.runMutation(internal.exports.finish, { exportId, fileId, videos: manifest.videos.length })
    } catch (e) {
      console.error(`Export ${job.ref} failed`, e)
      await ctx.runMutation(internal.exports.fail, { exportId })
    }
  },
})

export const start = internalMutation({
  args: { exportId: v.id('exports') },
  handler: async (ctx, { exportId }) => {
    const job = await ctx.db.get(exportId)
    if (!job || job.status !== 'queued') return null
    await ctx.db.patch(exportId, { status: 'packaging' })
    const mission = await ctx.db.get(job.missionId)
    return {
      ref: job.ref,
      format: job.format,
      includeRejected: job.includeRejected,
      createdAt: iso(job._creationTime),
      dataset: datasetJson(mission),
    }
  },
})

export const videoPage = internalQuery({
  args: {
    exportId: v.id('exports'),
    status: v.union(v.literal('accepted'), v.literal('rejected')),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { exportId, status, paginationOpts }) => {
    const job = await ctx.db.get(exportId)
    const mission = await ctx.db.get(job.missionId)
    const page = await ctx.db
      .query('videos')
      .withIndex('by_mission_and_status', (q) => q.eq('missionId', mission._id).eq('status', status))
      .paginate(paginationOpts)
    const picked = page.page.filter(
      (v) => (!job.taskIds || job.taskIds.includes(v.taskId)) && (!job.createdAfter || (v.reviewedAt ?? 0) > job.createdAfter),
    )
    return {
      videos: await Promise.all(picked.map((v) => videoJson(ctx, v, mission))),
      isDone: page.isDone,
      cursor: page.continueCursor,
    }
  },
})

export const finish = internalMutation({
  args: { exportId: v.id('exports'), fileId: v.id('_storage'), videos: v.number() },
  handler: async (ctx, { exportId, fileId, videos }) => {
    await ctx.db.patch(exportId, {
      status: 'ready',
      fileId,
      url: (await ctx.storage.getUrl(fileId)) ?? undefined,
      videos,
      completedAt: Date.now(),
    })
    const job = await ctx.db.get(exportId)
    await emitEvent(ctx, job.orgId, 'export.ready', exportJson(job, await ctx.db.get(job.missionId)))
  },
})

export const fail = internalMutation({
  args: { exportId: v.id('exports') },
  handler: async (ctx, { exportId }) => {
    await ctx.db.patch(exportId, { status: 'failed', error: 'Packaging failed. Create the export again.', completedAt: Date.now() })
  },
})
