import { internalMutation } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { emitEvent } from './lib/events'
import { completeIfDone } from './lib/missions'
import { PROCESSING_FEE } from './lib/pricing'
import { balanceJson, videoJson } from './lib/serialize'
import { addUsage, isoDay } from './lib/usage'

// Entry points for the collector app, which reaches them over HTTP through
// lib/collectorRest.js. Everything downstream (counters, charges, datasets,
// webhooks, completion) runs here, so the API and dashboard fill in on their own.
// To try it by hand: `npx convex run collection:submitVideo '{...}'`.

const round2 = (n) => Math.round(n * 100) / 100

async function uniqueVideoRef(ctx, orgId) {
  for (;;) {
    const ref = `VID-${Math.floor(10_000_000 + Math.random() * 90_000_000)}`
    const taken = await ctx.db
      .query('videos')
      .withIndex('by_org_and_ref', (q) => q.eq('orgId', orgId).eq('ref', ref))
      .unique()
    if (!taken) return ref
  }
}

/** A collector uploaded a clip for a task. It waits in `processing` until reviewed. */
export const submitVideo = internalMutation({
  args: {
    missionId: v.id('missions'),
    taskId: v.string(),
    duration: v.number(),
    resolution: v.string(),
    fps: v.number(),
    sizeMb: v.number(),
    device: v.string(),
    collectorId: v.string(),
    region: v.string(),
    fileId: v.optional(v.id('_storage')),
    annotationsFileId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    if (args.fileId) {
      // The app retrying after a dropped connection: same file, same video.
      const existing = await ctx.db
        .query('videos')
        .withIndex('by_fileId', (q) => q.eq('fileId', args.fileId))
        .first()
      if (existing) return existing.ref
    }
    const mission = await ctx.db.get(args.missionId)
    // Paused missions still accept clips that were already recorded.
    if (!mission || !['dispatching', 'active', 'paused'].includes(mission.status)) {
      throw new ConvexError('This mission is not collecting videos')
    }
    const task = mission.tasks.find((t) => t.id === args.taskId)
    if (!task) throw new ConvexError(`Unknown task ${args.taskId}`)
    const submittedOn = isoDay(Date.now())
    const ref = await uniqueVideoRef(ctx, mission.orgId)
    await ctx.db.insert('videos', {
      ...args,
      orgId: mission.orgId,
      ref,
      status: 'processing',
      quality: null,
      rejectionReason: null,
      labels: task.labels,
      checks: null,
      submittedOn,
    })
    await ctx.db.patch(mission._id, {
      submitted: mission.submitted + 1,
      tasks: mission.tasks.map((t) => (t.id === task.id ? { ...t, submitted: t.submitted + 1 } : t)),
    })
    await addUsage(ctx, { orgId: mission.orgId, missionId: mission._id, date: submittedOn }, { submitted: 1 })
    return ref
  },
})

/**
 * Quality review finished. Charges the QA fee (plus the task price if accepted),
 * creates the dataset at the first acceptance, fires webhooks and completes the
 * mission when it reaches its target.
 */
export const reviewVideo = internalMutation({
  args: {
    videoId: v.id('videos'),
    accepted: v.boolean(),
    quality: v.number(),
    rejectionReason: v.optional(v.string()),
    checks: v.object({
      handsInFrame: v.boolean(),
      lighting: v.number(),
      blur: v.number(),
      taskComplete: v.boolean(),
      privacy: v.boolean(),
    }),
  },
  handler: async (ctx, { videoId, accepted, quality, rejectionReason, checks }) => {
    const video = await ctx.db.get(videoId)
    if (!video || video.status !== 'processing') throw new ConvexError('Video is not awaiting review')
    const mission = await ctx.db.get(video.missionId)
    const org = await ctx.db.get(mission.orgId)
    const task = mission.tasks.find((t) => t.id === video.taskId)
    const charge = round2(PROCESSING_FEE + (accepted ? task.price : 0))
    const now = Date.now()

    const orgPatch = { balance: round2(org.balance - charge) }
    const missionPatch = {
      cost: round2(mission.cost + charge),
      tasks: mission.tasks.map((t) =>
        t.id !== task.id
          ? t
          : accepted
            ? { ...t, accepted: t.accepted + 1, acceptedSeconds: t.acceptedSeconds + video.duration }
            : { ...t, rejected: t.rejected + 1 },
      ),
    }
    if (accepted) {
      Object.assign(missionPatch, {
        accepted: mission.accepted + 1,
        acceptedSeconds: mission.acceptedSeconds + video.duration,
        qualitySum: mission.qualitySum + quality,
        lastAcceptedAt: now,
      })
      if (!mission.datasetRef) {
        const seq = org.seq ?? { mission: 1000, dataset: 300 }
        orgPatch.seq = { ...seq, dataset: seq.dataset + 1 }
        Object.assign(missionPatch, { datasetRef: `DS-${seq.dataset + 1}`, datasetVersion: 'v1.0' })
      }
    } else {
      missionPatch.rejected = mission.rejected + 1
    }

    await ctx.db.patch(videoId, {
      status: accepted ? 'accepted' : 'rejected',
      quality,
      rejectionReason: accepted ? null : (rejectionReason ?? 'Failed quality review'),
      checks,
      reviewedAt: now,
    })
    await ctx.db.patch(mission._id, missionPatch)
    await ctx.db.patch(org._id, orgPatch)
    await addUsage(
      ctx,
      { orgId: org._id, missionId: mission._id, date: video.submittedOn },
      { [accepted ? 'accepted' : 'rejected']: 1, cost: charge },
    )

    const updated = await ctx.db.get(mission._id)
    await emitEvent(ctx, org._id, accepted ? 'video.accepted' : 'video.rejected', await videoJson(ctx, await ctx.db.get(videoId), updated))
    const { threshold } = org.autoRecharge
    if (org.balance >= threshold && orgPatch.balance < threshold) {
      await emitEvent(ctx, org._id, 'balance.low', balanceJson({ ...org, ...orgPatch }))
    }
    await completeIfDone(ctx, updated)
  },
})
