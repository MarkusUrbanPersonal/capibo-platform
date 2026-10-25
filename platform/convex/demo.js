import { internalMutation } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { createMission } from './lib/missions'
import { PROCESSING_FEE } from './lib/pricing'
import { addUsage } from './lib/usage'

// Demo helpers, run by hand with `npx convex run [--prod] demo:<name> '{...}'`.
// Nothing in the platform or the APIs calls them.

const round2 = (n) => Math.round(n * 100) / 100
const between = (lo, hi) => Math.round(lo + Math.random() * (hi - lo))
const DAY = 86_400_000

const DEVICES = ['iPhone 15 Pro', 'Pixel 8', 'iPhone 14', 'Galaxy S24']
const COLLECTORS = ['col_4fk2m9', 'col_8hq1x3', 'col_2pz7c5', 'col_9wd6n4']
const REJECTIONS = [
  { reason: 'Hands leave frame for more than 2s', checks: { handsInFrame: false } },
  { reason: 'Motion blur above threshold', checks: { blur: 34 } },
  { reason: 'Insufficient lighting', checks: { lighting: 48 } },
]

// Per day: [taskId, outcome] for each submitted clip. A null outcome is still in review.
const PLAN = {
  yesterday: [['T-1', true], ['T-1', true], ['T-1', true], ['T-1', false], ['T-2', true], ['T-2', true], ['T-2', false]],
  today: [['T-1', true], ['T-1', true], ['T-2', true], ['T-2', false], ['T-1', null]],
}

/**
 * Gives the organization of `email` a small, realistic history for demos: an
 * active mission with a few clips submitted and reviewed yesterday and today.
 * Counters, usage, charges, the dataset and the balance move exactly as real
 * reviews would move them. `today` is the viewer's YYYY-MM-DD.
 */
export const seedUsage = internalMutation({
  args: { email: v.string(), today: v.string() },
  handler: async (ctx, { email, today }) => {
    const member = await ctx.db
      .query('members')
      .withIndex('by_email', (q) => q.eq('email', email.trim().toLowerCase()))
      .filter((q) => q.eq(q.field('pending'), false))
      .first()
    if (!member) throw new ConvexError(`No account for ${email}. Sign up first.`)
    const yesterday = new Date(Date.parse(today + 'T00:00:00Z') - DAY).toISOString().slice(0, 10)
    const existing = await ctx.db
      .query('usageDaily')
      .withIndex('by_org_and_date', (q) => q.eq('orgId', member.orgId).gte('date', yesterday).lte('date', today))
      .first()
    if (existing) throw new ConvexError('This organization already has usage for those days.')

    let org = await ctx.db.get(member.orgId)
    const mission = await createMission(ctx, org, {
      name: 'Kitchen manipulation',
      description: 'Egocentric clips of everyday kitchen tasks for a household manipulation policy.',
      regions: ['US'],
      guidelines: ['Camera at eye level, head-mounted or chest-mounted', 'Both hands visible for the whole clip', 'No faces or screens in frame'],
      tasks: [
        { name: 'Load a dishwasher', videos: 60, duration: [8, 15], labels: ['dishwasher', 'kitchen', 'grasp'], icon: 'Utensils', tone: 'sky', instructions: 'Load at least four items into the dishwasher, then close the door.' },
        { name: 'Wipe a countertop', videos: 60, duration: [5, 10], labels: ['countertop', 'kitchen', 'wipe'], icon: 'SprayCan', tone: 'emerald', instructions: 'Wipe the whole countertop with a cloth in overlapping strokes.' },
      ],
      dispatch: false,
      source: 'platform',
      userId: member.userId,
    })

    org = await ctx.db.get(org._id)
    const tasks = Object.fromEntries(mission.tasks.map((t) => [t.id, { ...t }]))
    const totals = { submitted: 0, accepted: 0, rejected: 0, cost: 0, acceptedSeconds: 0, qualitySum: 0 }
    const seq = org.seq ?? { mission: 1000, dataset: 300 }
    const datasetRef = `DS-${seq.dataset + 1}`
    let lastAcceptedAt
    let rejections = 0

    for (const [day, clips] of [[yesterday, PLAN.yesterday], [today, PLAN.today]]) {
      const dayStart = Date.parse(day + 'T15:00:00Z')
      const usage = { submitted: 0, accepted: 0, rejected: 0, cost: 0 }
      for (const [i, [taskId, accepted]] of clips.entries()) {
        const task = tasks[taskId]
        const duration = between(task.duration[0], task.duration[1])
        // Spread clips over the afternoon, never in the future.
        const reviewedAt = Math.min(Date.now() - 60_000, dayStart + i * 47 * 60_000)
        const reviewed = accepted !== null
        const rejection = accepted === false ? REJECTIONS[rejections++ % REJECTIONS.length] : null
        const quality = !reviewed ? null : accepted ? between(78, 96) : between(41, 68)
        await ctx.db.insert('videos', {
          orgId: org._id,
          missionId: mission._id,
          ref: `VID-${between(10_000_000, 99_999_999)}`,
          taskId,
          status: !reviewed ? 'processing' : accepted ? 'accepted' : 'rejected',
          quality,
          rejectionReason: rejection?.reason ?? null,
          duration,
          resolution: '1920x1080',
          fps: 30,
          sizeMb: round2(duration * 2.3),
          device: DEVICES[i % DEVICES.length],
          collectorId: COLLECTORS[(i + (day === today ? 1 : 0)) % COLLECTORS.length],
          region: 'US',
          labels: task.labels,
          checks: !reviewed
            ? null
            : {
                handsInFrame: true,
                lighting: between(74, 95),
                blur: between(2, 14),
                taskComplete: true,
                privacy: true,
                ...rejection?.checks,
              },
          submittedOn: day,
          ...(reviewed ? { reviewedAt } : {}),
        })
        task.submitted += 1
        usage.submitted += 1
        if (!reviewed) continue
        const charge = round2(PROCESSING_FEE + (accepted ? task.price : 0))
        usage.cost = round2(usage.cost + charge)
        if (accepted) {
          task.accepted += 1
          task.acceptedSeconds += duration
          usage.accepted += 1
          totals.acceptedSeconds += duration
          totals.qualitySum += quality
          lastAcceptedAt = reviewedAt
        } else {
          task.rejected += 1
          usage.rejected += 1
        }
      }
      await addUsage(ctx, { orgId: org._id, missionId: mission._id, date: day }, usage)
      for (const k of ['submitted', 'accepted', 'rejected']) totals[k] += usage[k]
      totals.cost = round2(totals.cost + usage.cost)
    }

    // Throwing rolls everything back, mission included.
    if (org.balance < totals.cost) {
      throw new ConvexError(`The balance doesn't cover the $${totals.cost} of demo charges. Redeem a promo code in Billing first.`)
    }
    await ctx.db.patch(mission._id, {
      status: 'active',
      startedAt: Date.parse(yesterday + 'T14:00:00Z'),
      tasks: mission.tasks.map((t) => tasks[t.id]),
      submitted: totals.submitted,
      accepted: totals.accepted,
      rejected: totals.rejected,
      cost: totals.cost,
      acceptedSeconds: totals.acceptedSeconds,
      qualitySum: totals.qualitySum,
      datasetRef,
      datasetVersion: 'v1.0',
      lastAcceptedAt,
    })
    await ctx.db.patch(org._id, { balance: round2(org.balance - totals.cost), seq: { ...seq, dataset: seq.dataset + 1 } })
    return { mission: mission.ref, dataset: datasetRef, ...totals, balance: round2(org.balance - totals.cost) }
  },
})

/** Deletes a throwaway test account and its organization. Only for @example.com addresses. */
export const removeTestAccount = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    if (!email.endsWith('@example.com')) throw new ConvexError('Only @example.com test accounts can be removed.')
    const user = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', email))
      .unique()
    if (!user) return null
    const members = await ctx.db
      .query('members')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()
    for (const m of members) {
      const others = await ctx.db
        .query('members')
        .withIndex('by_org', (q) => q.eq('orgId', m.orgId))
        .collect()
      if (others.length === 1) {
        for (const mission of await ctx.db.query('missions').withIndex('by_org', (q) => q.eq('orgId', m.orgId)).collect()) {
          for (const video of await ctx.db.query('videos').withIndex('by_mission_and_status', (q) => q.eq('missionId', mission._id)).collect()) {
            await ctx.db.delete(video._id)
          }
          await ctx.db.delete(mission._id)
        }
        for (const row of await ctx.db.query('usageDaily').withIndex('by_org_and_date', (q) => q.eq('orgId', m.orgId)).collect()) {
          await ctx.db.delete(row._id)
        }
        for (const table of ['apiKeys', 'transactions', 'webhooks']) {
          for (const row of await ctx.db.query(table).withIndex('by_org', (q) => q.eq('orgId', m.orgId)).collect()) {
            await ctx.db.delete(row._id)
          }
        }
        await ctx.db.delete(m.orgId)
      }
      await ctx.db.delete(m._id)
    }
    for (const s of await ctx.db.query('authSessions').withIndex('userId', (q) => q.eq('userId', user._id)).collect()) {
      for (const t of await ctx.db.query('authRefreshTokens').withIndex('sessionId', (q) => q.eq('sessionId', s._id)).collect()) {
        await ctx.db.delete(t._id)
      }
      await ctx.db.delete(s._id)
    }
    for (const a of await ctx.db.query('authAccounts').withIndex('userIdAndProvider', (q) => q.eq('userId', user._id)).collect()) {
      await ctx.db.delete(a._id)
    }
    await ctx.db.delete(user._id)
    return email
  },
})
