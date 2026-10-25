import { internalMutation, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { CAN, requireMember } from './lib/orgs'
import { createMission, findMission, parseTasks, REGIONS, updateMission } from './lib/missions'
import { progressOf } from './lib/serialize'
import { dailyUsage, isoDay, windowEnding } from './lib/usage'
import { strArray } from './lib/validate'

/** A mission as the platform's views use it. */
export function missionView(m) {
  return {
    id: m.ref,
    name: m.name,
    description: m.description,
    status: m.status,
    regions: m.regions,
    guidelines: m.guidelines,
    icon: m.icon ?? null,
    tone: m.tone ?? null,
    createdAt: m._creationTime,
    start: isoDay(m.startedAt ?? m._creationTime),
    end: m.completedAt ? isoDay(m.completedAt) : null,
    target: m.target,
    submitted: m.submitted,
    processing: m.submitted - m.accepted - m.rejected,
    processed: m.accepted + m.rejected,
    accepted: m.accepted,
    rejected: m.rejected,
    cost: m.cost,
    progress: progressOf(m),
    datasetId: m.datasetRef ?? null,
    tasks: m.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      instructions: t.instructions,
      videos: t.videos,
      duration: t.duration,
      labels: t.labels,
      icon: t.icon ?? null,
      tone: t.tone ?? null,
      price: t.price,
      submitted: t.submitted,
      accepted: t.accepted,
      rejected: t.rejected,
      avgDuration: t.accepted ? Math.round(t.acceptedSeconds / t.accepted) : null,
    })),
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { org } = await requireMember(ctx)
    const missions = await ctx.db
      .query('missions')
      .withIndex('by_org', (q) => q.eq('orgId', org._id))
      .order('desc')
      .take(200)
    return missions.filter((m) => !m.deletedAt).map(missionView)
  },
})

export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const { org } = await requireMember(ctx)
    try {
      return missionView(await findMission(ctx, org._id, id))
    } catch {
      return null
    }
  },
})

/** Daily counts for one mission over the `days` ending on `today` (the viewer's date). */
export const daily = query({
  args: { id: v.string(), today: v.string(), days: v.number() },
  handler: async (ctx, { id, today, days }) => {
    const { org } = await requireMember(ctx)
    const mission = await findMission(ctx, org._id, id)
    const [from, to] = windowEnding(today, Math.min(Math.max(days, 1), 366))
    const rows = await dailyUsage(ctx, { orgId: org._id, missionId: mission._id, from, to })
    return rows.map((r) => ({
      ...r,
      processing: r.submitted - r.accepted - r.rejected,
      processed: r.accepted + r.rejected,
    }))
  },
})

/** Launches a mission from the planner. Charges nothing up front, but the balance must cover the estimate. */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    regions: v.optional(v.array(v.string())),
    guidelines: v.optional(v.array(v.string())),
    icon: v.optional(v.string()),
    tone: v.optional(v.string()),
    tasks: v.array(
      v.object({
        name: v.string(),
        instructions: v.optional(v.string()),
        videos: v.number(),
        duration: v.array(v.number()),
        labels: v.optional(v.array(v.string())),
        icon: v.optional(v.string()),
        tone: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { org, userId } = await requireMember(ctx, CAN.manageMissions)
    const mission = await createMission(ctx, org, {
      name: args.name.trim() || 'Untitled mission',
      description: args.description,
      regions: strArray(args.regions, 'regions', { values: REGIONS }),
      guidelines: args.guidelines,
      icon: args.icon,
      tone: args.tone,
      tasks: parseTasks(args.tasks),
      dispatch: true,
      source: 'platform',
      userId,
    })
    return mission.ref
  },
})

export const setStatus = mutation({
  args: { id: v.string(), status: v.union(v.literal('active'), v.literal('paused')) },
  handler: async (ctx, { id, status }) => {
    const { org } = await requireMember(ctx, CAN.manageMissions)
    await updateMission(ctx, org, await findMission(ctx, org._id, id), { status })
  },
})

/** Stops collection and hides the mission. Its dataset, if any, stays available. */
export const remove = mutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const { org } = await requireMember(ctx, CAN.manageMissions)
    const mission = await findMission(ctx, org._id, id)
    const running = mission.status === 'active' || mission.status === 'dispatching'
    await ctx.db.patch(mission._id, { deletedAt: Date.now(), ...(running ? { status: 'paused' } : {}) })
  },
})

/** Scheduled by dispatch: collectors have the tasks, so the mission goes live (unless paused meanwhile). */
export const finishDispatch = internalMutation({
  args: { missionId: v.id('missions') },
  handler: async (ctx, { missionId }) => {
    const mission = await ctx.db.get(missionId)
    if (mission?.status === 'dispatching') await ctx.db.patch(missionId, { status: 'active' })
  },
})
