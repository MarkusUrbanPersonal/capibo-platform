import { query } from './_generated/server'
import { v } from 'convex/values'
import { findDataset } from './lib/missions'
import { requireMember } from './lib/orgs'
import { datasetJson, iso } from './lib/serialize'

// Platform views of datasets. A dataset is a mission's accepted videos (see schema.js).

const RECENT_VIDEOS = 500

function datasetView(m) {
  const d = datasetJson(m)
  return {
    id: d.id,
    name: d.name,
    version: d.version,
    missionId: m.ref,
    missionName: m.name,
    missionIcon: m.icon ?? null,
    missionTone: m.tone ?? null,
    description: m.description,
    missionDeleted: Boolean(m.deletedAt),
    videos: d.videos,
    hours: d.hours,
    avgQuality: d.avg_quality,
    updatedAt: d.updated_at,
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { org } = await requireMember(ctx)
    const missions = await ctx.db
      .query('missions')
      .withIndex('by_org_and_datasetRef', (q) => q.eq('orgId', org._id).gte('datasetRef', ''))
      .order('desc')
      .take(200)
    return missions.map(datasetView)
  },
})

export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const { org } = await requireMember(ctx)
    try {
      return datasetView(await findDataset(ctx, org._id, id))
    } catch {
      return null
    }
  },
})

/** The dataset mission's most recent submissions, any status, newest first. */
export const videos = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const { org } = await requireMember(ctx)
    const mission = await findDataset(ctx, org._id, id)
    const byStatus = await Promise.all(
      ['accepted', 'rejected', 'processing'].map((status) =>
        ctx.db
          .query('videos')
          .withIndex('by_mission_and_status', (q) => q.eq('missionId', mission._id).eq('status', status))
          .order('desc')
          .take(RECENT_VIDEOS),
      ),
    )
    const recent = byStatus
      .flat()
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, RECENT_VIDEOS)
    return await Promise.all(
      recent.map(async (v) => ({
        id: v.ref,
        missionId: mission.ref,
        mission: mission.name,
        taskId: v.taskId,
        task: mission.tasks.find((t) => t.id === v.taskId)?.name ?? v.taskId,
        status: v.status,
        quality: v.quality,
        rejectionReason: v.rejectionReason,
        duration: v.duration,
        resolution: v.resolution,
        fps: v.fps,
        sizeMb: v.sizeMb,
        device: v.device,
        collector: v.collectorId,
        region: v.region,
        labels: v.labels,
        checks: v.checks,
        createdAt: iso(v._creationTime),
        downloadUrl: v.status === 'accepted' && v.fileId ? await ctx.storage.getUrl(v.fileId) : null,
      })),
    )
  },
})
