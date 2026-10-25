import { internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { notFound } from './lib/errors'
import { iso, videoJson } from './lib/serialize'

// Data access for the collector app's API (lib/collectorRest.js). Unlike the REST
// API it isn't scoped to one organization: collectors see every open mission.
// Missions and videos are addressed by their Convex ids, since MSN-/VID- refs are
// only unique within an organization.

const OPEN_STATUSES = ['dispatching', 'active']
const MAX_PER_STATUS = 200

function missionForCollector(m) {
  return {
    id: m._id,
    ref: m.ref,
    name: m.name,
    description: m.description,
    status: m.status,
    regions: m.regions,
    guidelines: m.guidelines,
    target: m.target,
    submitted: m.submitted,
    accepted: m.accepted,
    rejected: m.rejected,
    tasks: m.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      instructions: t.instructions,
      duration: t.duration,
      labels: t.labels,
      videos: t.videos,
      submitted: t.submitted,
      accepted: t.accepted,
      rejected: t.rejected,
      remaining: Math.max(0, t.videos - t.accepted),
      price: t.price,
    })),
    created_at: iso(m._creationTime),
    started_at: iso(m.startedAt),
  }
}

async function findMission(ctx, id) {
  const missionId = ctx.db.normalizeId('missions', id)
  const mission = missionId && (await ctx.db.get(missionId))
  if (!mission || mission.deletedAt) throw notFound('mission', id)
  return mission
}

async function videoForCollector(ctx, video) {
  const mission = await ctx.db.get(video.missionId)
  return { ...(await videoJson(ctx, video, mission)), id: video._id, ref: video.ref, mission_id: mission._id }
}

/** Missions collectors can record for right now, newest first. */
export const listOpenMissions = internalQuery({
  args: { region: v.optional(v.string()) },
  handler: async (ctx, { region }) => {
    const missions = []
    for (const status of OPEN_STATUSES) {
      missions.push(
        ...(await ctx.db
          .query('missions')
          .withIndex('by_status', (q) => q.eq('status', status))
          .order('desc')
          .take(MAX_PER_STATUS)),
      )
    }
    return missions
      .filter((m) => !m.deletedAt && (!region || m.regions.includes(region)))
      .sort((a, b) => b._creationTime - a._creationTime)
      .map(missionForCollector)
  },
})

export const getMission = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, { id }) => missionForCollector(await findMission(ctx, id)),
})

/** An uploaded file's id and size, or null if `id` isn't one. */
export const storedFile = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const fileId = ctx.db.system.normalizeId('_storage', id)
    const file = fileId && (await ctx.db.system.get(fileId))
    if (!file) return null
    return { fileId, sizeMb: Math.round((file.size / 1_048_576) * 10) / 10 }
  },
})

export const getVideo = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const videoId = ctx.db.normalizeId('videos', id)
    const video = videoId && (await ctx.db.get(videoId))
    if (!video) throw notFound('video', id)
    return await videoForCollector(ctx, video)
  },
})

export const getVideoByFile = internalQuery({
  args: { fileId: v.id('_storage') },
  handler: async (ctx, { fileId }) => {
    const video = await ctx.db
      .query('videos')
      .withIndex('by_fileId', (q) => q.eq('fileId', fileId))
      .first()
    if (!video) throw notFound('video', fileId)
    return await videoForCollector(ctx, video)
  },
})
