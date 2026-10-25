import { computeEstimate as priceTasks, PROCESSING_FEE, priceFor as priceForDuration } from '@convex/lib/pricing'
import { api } from '@convex/_generated/api'
import { planner, launchMission, resetPlanner } from '@/stores/missions'
import { organization } from '@/stores/session'
import { convex, errorMessage } from '@/lib/convex'

/**
 * Mission-planning agent. Planning is done by an LLM (convex/planner.js): it
 * decomposes a natural-language goal into 4 or 6 filmable video tasks and picks an
 * icon and color for each. Edits, estimates and launches are handled here with
 * the same pricing as the API, and launching creates a real mission in Convex.
 */

export const PLANNER_MODEL = 'gpt-5.4-mini'

// Slash commands in assistant-ui's shape (`id`, `description`, `icon`), grouped by `category`.
// `args` commands insert `/id ` for the user to finish; the rest run immediately.
export const SLASH_COMMANDS = [
  { id: 'estimate', description: 'Estimate cost and timeline for the plan', icon: 'calculator', category: 'Commands' },
  { id: 'launch', description: 'Dispatch the approved plan to collectors', icon: 'send', category: 'Commands' },
  { id: 'usage', description: 'Tokens and cost used by this conversation', icon: 'gauge', category: 'Commands' },
  { id: 'help', description: 'What the mission planner can do', icon: 'help', category: 'Commands' },
]

const DEFAULT_GUIDELINES = [
  'Chest- or head-mounted phone, landscape, 1080p or higher',
  'Both hands visible for the whole clip',
  'Neutral, well-lit surface; no faces in frame',
]

const priceFor = (task) => priceForDuration(task.duration)

// The model's plan → the planner's working draft, priced with the shared pricing.
function toDraft(plan) {
  return {
    ...plan,
    tasks: plan.tasks.map((t, i) => ({
      id: `task-${i + 1}`,
      ...t,
      guidelines: DEFAULT_GUIDELINES,
      price: priceFor(t),
      enabled: true,
    })),
  }
}

const snapshot = (plan) => JSON.parse(JSON.stringify(plan))

export function makeTask(name, i) {
  const t = {
    id: `task-${Date.now().toString(36)}-${i}`,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    description: `Perform “${name}” end to end at a natural pace.`,
    duration: [10, 25],
    videos: 50,
    guidelines: DEFAULT_GUIDELINES,
    enabled: true,
  }
  t.price = priceFor(t)
  return t
}

export function computeEstimate(plan) {
  return priceTasks(plan.tasks.filter((t) => t.enabled))
}

const fmtUsd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

// --- Agent work log ---------------------------------------------------------

/**
 * Emit an `agent_steps` tool call and run its steps one after another:
 * each step shows a spinner, then turns green with its final detail. A step
 * with `run` waits for that async function (its return value is the detail);
 * if it throws, the step turns red and the error is rethrown. A `detail`
 * function is evaluated when its step finishes.
 */
async function runSteps(ctx, { title, doneTitle, failedTitle }, steps) {
  const started = Date.now()
  const result = {
    title,
    doneTitle,
    failedTitle,
    done: false,
    steps: steps.map((s) => ({ label: s.label, detail: s.running ?? '', status: 'pending' })),
  }
  const call = ctx.tool('agent_steps', { title }, snapshot(result))
  for (let i = 0; i < steps.length; i++) {
    result.steps[i].status = 'running'
    call.update({ result: snapshot(result) })
    if (steps[i].run) {
      try {
        result.steps[i].detail = await steps[i].run()
      } catch (e) {
        result.steps[i].status = 'error'
        result.steps[i].detail = errorMessage(e)
        result.failed = true
        call.update({ result: snapshot(result) })
        throw e
      }
    } else {
      await ctx.wait(steps[i].ms ?? 650)
    }
    result.steps[i].status = 'done'
    if (!steps[i].run) result.steps[i].detail = typeof steps[i].detail === 'function' ? steps[i].detail() : steps[i].detail
    call.update({ result: snapshot(result) })
  }
  await ctx.wait(250)
  result.done = true
  result.elapsedMs = Date.now() - started
  call.update({ result: snapshot(result) })
}

/** Awaits `promise`, but rejects as soon as the user stops the run. */
function untilCancelled(ctx, promise) {
  return Promise.race([promise, ctx.wait(10 * 60_000).then(() => promise)])
}

// --- Intent handlers --------------------------------------------------------

const PLANNING_STEPS = [
  {
    label: 'Breaking it into recordable tasks',
    running: 'Segmenting the behavior…',
    detail: (plan) => `${plan.tasks.length} tasks drafted · ${plan.name}`,
  },
  {
    label: 'Choosing icons and colors',
    running: 'Matching each task to an icon…',
    detail: (plan) => `${new Set(plan.tasks.map((t) => t.icon)).size} icons · ${new Set(plan.tasks.map((t) => t.tone)).size} colors`,
  },
  { label: 'Writing recording guidelines', running: 'Framing, lighting, privacy…', detail: () => `${DEFAULT_GUIDELINES.length} guidelines shared by all tasks` },
  {
    label: 'Pricing each task',
    running: 'Scaling by clip length…',
    detail: (plan) => `Avg. ${fmtUsd(plan.tasks.reduce((s, t) => s + t.price, 0) / plan.tasks.length)} per accepted video`,
  },
]
const PLANNING_STEP_MS = 900

/**
 * Plays the planning steps like a loader while the model works: each step but
 * the last ticks over on a timer, and the last one spins until the plan is
 * back. Details are filled in once the plan exists. Resolves to the model's
 * response; rejects (with the running step turned red) if the call fails.
 */
async function runPlanningSteps(ctx, request) {
  const started = Date.now()
  const result = {
    title: 'Planning your mission',
    doneTitle: 'Mission planned',
    failedTitle: 'Planning failed',
    done: false,
    steps: PLANNING_STEPS.map((s) => ({ label: s.label, detail: s.running, status: 'pending' })),
  }
  const call = ctx.tool('agent_steps', { title: result.title }, snapshot(result))
  const push = () => call.update({ result: snapshot(result) })

  let response
  let error
  let settled = false
  const pending = untilCancelled(ctx, request).then(
    (r) => ((response = r), (settled = true)),
    (e) => ((error = e), (settled = true)),
  )

  // Settles only on failure, so a failed call stops the animation right away.
  const failed = pending.then(() => error || new Promise(() => {}))
  const last = PLANNING_STEPS.length - 1
  for (let i = 0; i < last; i++) {
    result.steps[i].status = 'running'
    push()
    await Promise.race([ctx.wait(settled ? 220 : PLANNING_STEP_MS), failed])
    if (error) break
    result.steps[i].status = 'done'
    result.steps[i].detail = ''
  }
  const current = result.steps.findIndex((s) => s.status !== 'done')
  result.steps[current].status = 'running'
  push()
  await pending

  if (error) {
    result.steps[current].status = 'error'
    result.steps[current].detail = errorMessage(error)
    result.failed = true
    push()
    throw error
  }
  if (!response.plan) {
    result.steps[current].status = 'error'
    result.steps[current].detail = 'Not a robot behavior'
    result.failed = true
    result.failedTitle = 'Nothing to plan'
    push()
    return response
  }
  const plan = toDraft(response.plan)
  PLANNING_STEPS.forEach((s, i) => Object.assign(result.steps[i], { status: 'done', detail: s.detail(plan) }))
  push()
  await ctx.wait(250)
  result.done = true
  result.elapsedMs = Date.now() - started
  push()
  return { ...response, plan }
}

async function proposePlan(goal, ctx) {
  resetPlanner()
  let plan
  try {
    const res = await runPlanningSteps(ctx, convex.action(api.planner.planMission, { goal }))
    ctx.usage?.record(res.usage)
    if (!res.plan) {
      return ctx.say(`${res.clarification} Tell me what your robot should learn, e.g. *“I want to create a robot that folds clothes.”*`)
    }
    plan = res.plan
  } catch (e) {
    if (ctx.signal.aborted) throw e
    return ctx.say(`I couldn't plan this mission: ${errorMessage(e)}`)
  }
  if (plan.reasoning) await ctx.think(plan.reasoning)
  await ctx.say(`Here's how I'd break **${plan.name.toLowerCase()}** into videos your collectors can record. Each task is a separate clip type, so labels stay clean and you can weight the hard steps.`)

  // Stream the tasks into the plan card one at a time.
  planner.plan = { name: plan.name, objective: plan.objective, icon: plan.icon, tone: plan.tone, tasks: [] }
  const call = ctx.tool('propose_tasks', { goal, ...snapshot(planner.plan) }, { status: 'proposed', drafting: true })
  planner.planCallId = call.toolCallId
  for (const task of plan.tasks) {
    await ctx.wait(320)
    planner.plan.tasks.push(task)
    call.update({ args: { goal, ...snapshot(planner.plan) } })
  }
  await ctx.wait(200)
  call.update({ result: { status: 'proposed' } })
  await ctx.say(
    `Review the tasks above: switch off anything you don't need, adjust video counts, or ask me to add more${plan.followUps[0] ? ` — for example *“add ${plan.followUps[0]}”*` : ''}. When it looks right, click **Approve plan** and I'll prepare a cost estimate.`,
  )
}

async function addTasks(names, ctx) {
  await ctx.think(`The user wants additional coverage: ${names.join(', ')}. I'll add ${names.length > 1 ? 'these as separate tasks' : 'this as a separate task'} with a default of 50 videos and the standard recording guidelines, then re-issue the plan for review.`)
  const added = names.map((n, i) => makeTask(n, i))
  planner.plan.tasks.push(...added)
  planner.estimate = null
  const call = ctx.tool('propose_tasks', { goal: 'revision', ...snapshot(planner.plan) }, { status: 'revised', added: added.map((t) => t.name) })
  planner.planCallId = call.toolCallId
  await ctx.say(`Added **${added.map((t) => t.name).join('**, **')}**. The plan now has ${planner.plan.tasks.filter((t) => t.enabled).length} active tasks. Anything else, or shall I estimate the cost?`)
}

/**
 * Sends a free-form message about the current plan to the model, which either
 * returns edits (switch off, change, add tasks) or routes it: estimate, launch,
 * a new plan, an answer, or "I didn't get …".
 */
async function revisePlan(message, ctx) {
  let res
  try {
    const plan = {
      name: planner.plan.name,
      objective: planner.plan.objective ?? '',
      tasks: planner.plan.tasks.map((t) => ({ id: t.id, name: t.name, description: t.description ?? '', duration: t.duration, videos: Number(t.videos) || 0, enabled: t.enabled })),
    }
    res = await untilCancelled(ctx, convex.action(api.planner.editPlan, { message, plan }))
  } catch (e) {
    if (ctx.signal.aborted) throw e
    return ctx.say(`I couldn't update the plan: ${errorMessage(e)}`)
  }
  ctx.usage?.record(res.usage)
  const { intent, reply, remove, update, add } = res.edit
  if (intent === 'estimate') return estimate(ctx)
  if (intent === 'launch') return planner.estimate ? launch(ctx) : estimate(ctx)
  if (intent === 'new_plan') return proposePlan(message, ctx)
  if (intent !== 'edit') return ctx.say(reply)

  const byId = new Map(planner.plan.tasks.map((t) => [t.id, t]))
  const removed = remove.map((id) => byId.get(id)).filter((t) => t.enabled)
  removed.forEach((t) => (t.enabled = false))
  const changed = update.map(({ id, ...patch }) => {
    const task = Object.assign(byId.get(id), patch)
    task.price = priceFor(task)
    return task
  })
  const offset = planner.plan.tasks.length
  const added = add.map((t, i) => ({ id: `task-${Date.now().toString(36)}-${offset + i}`, ...t, guidelines: DEFAULT_GUIDELINES, price: priceFor(t), enabled: true }))
  planner.plan.tasks.push(...added)
  if (removed.length + changed.length + added.length === 0) return ctx.say(reply)

  planner.estimate = null
  const call = ctx.tool(
    'propose_tasks',
    { goal: 'revision', ...snapshot(planner.plan) },
    { status: 'revised', added: added.map((t) => t.name), removed: removed.map((t) => t.name), changed: changed.map((t) => t.name) },
  )
  planner.planCallId = call.toolCallId
  await ctx.say(`${reply} The plan now has ${planner.plan.tasks.filter((t) => t.enabled).length} active tasks.`)
}

function balanceDetail(est) {
  const balance = organization.value?.balance ?? 0
  return balance >= est.total ? 'Balance covers this mission' : `${fmtUsd(est.total - balance)} short — add credits before launching`
}

async function estimate(ctx) {
  if (!planner.plan) return ctx.say('There is no plan yet. Describe what your robot should learn, e.g. *“I want to create a robot that folds clothes.”*')
  const est = computeEstimate(planner.plan)
  if (est.totalVideos === 0) return ctx.say('All tasks are switched off. Enable at least one task to estimate a cost.')
  await runSteps(ctx, { title: 'Estimating cost', doneTitle: 'Estimate ready' }, [
    { label: 'Totalling footage', running: 'Summing clip lengths…', detail: `${est.hours} hours across ${est.lines.length} tasks`, ms: 600 },
    { label: 'Forecasting acceptance rate', running: 'Using similar missions…', detail: `${Math.round(est.acceptRate * 100)}% expected → ${est.expectedSubmissions.toLocaleString('en-US')} submissions`, ms: 750 },
    { label: 'Sizing the collector pool', running: 'Matching skills and regions…', detail: `${est.collectors} collectors · ~${est.days} days`, ms: 700 },
    { label: 'Checking your credit balance', running: 'Reading billing…', detail: balanceDetail(est), ms: 500 },
  ])
  await ctx.think(
    `Pricing per accepted video scales with clip length. With an expected acceptance rate of ${Math.round(est.acceptRate * 100)}%, ${est.totalVideos.toLocaleString('en-US')} accepted videos need about ${est.expectedSubmissions.toLocaleString('en-US')} submissions, each charged a $${PROCESSING_FEE.toFixed(2)} QA processing fee. Collector capacity in the US supports ~${est.collectors} active collectors for this skill profile.`,
  )
  planner.estimate = est
  const call = ctx.tool('estimate_cost', { plan: planner.plan.name, tasks: est.lines.length }, est)
  planner.estimateCallId = call.toolCallId
  await ctx.say(`Estimated total: **${fmtUsd(est.total)}** for ${est.totalVideos.toLocaleString('en-US')} accepted videos (~${est.hours} hours of footage), delivered in about **${est.days} days**. You're only charged for accepted videos plus processing. Approve to dispatch the tasks to collectors.`)
}

async function launch(ctx) {
  if (!planner.plan) return ctx.say('There is no plan to launch yet. Start by describing the behavior you want to train.')
  if (!planner.estimate) {
    await ctx.say("Before launching, here's the cost estimate for review.")
    return estimate(ctx)
  }
  if (planner.launchedMissionId) return ctx.say(`This plan is already live as **${planner.launchedMissionId}**.`)
  const est = planner.estimate
  let id
  try {
    id = await launchMission(planner.plan, DEFAULT_GUIDELINES)
  } catch (e) {
    return ctx.say(`I couldn't launch the mission: ${errorMessage(e)} You can add credits under **Billing**, then ask me to launch again.`)
  }
  planner.launchedMissionId = id
  await ctx.say(`Launching **${planner.plan.name}** as mission **${id}**.`)
  // Only steps that really happened: the mission exists and is open in the app.
  // Collectors aren't notified individually, so there's no device count to show.
  const steps = [
    { label: `Create mission ${id}`, detail: `${est.lines.length} tasks · ${est.totalVideos.toLocaleString('en-US')} video target` },
    { label: 'Attach recording guidelines', detail: 'The same guidelines for every task' },
    { label: 'Publish tasks to the Capibo mobile app', detail: 'Collectors see them the next time they open the app' },
  ].map((s) => ({ ...s, status: 'pending' }))
  const result = { missionId: id, steps, done: false }
  const call = ctx.tool('dispatch_mission', { missionId: id }, snapshot(result))
  for (const step of result.steps) {
    step.status = 'running'
    call.update({ result: snapshot(result) })
    await ctx.wait(500)
    step.status = 'done'
    call.update({ result: snapshot(result) })
  }
  result.done = true
  call.update({ result: snapshot(result) })
  await ctx.say(`**${id} is live.** No videos have been submitted yet. You can follow progress under **Missions → Active**, and accepted videos will appear in **Datasets** as they pass QA.`)
}

// `/usage` normally opens the composer's usage dialog; this covers typed questions.
async function usageReport(ctx) {
  await ctx.say('Type `/usage` to open the usage report for this conversation, or hover the usage ring next to the send button.')
}

async function help(ctx) {
  await ctx.say(
    [
      "I'm the Capibo mission planner. I turn a robot goal into a data-collection mission:",
      '',
      '1. **Plan** — break the behavior into recordable video tasks',
      '2. **Review** — edit tasks, video counts and guidelines',
      '3. **Estimate** — cost, footage hours and delivery time',
      '4. **Launch** — dispatch tasks to collectors on the Capibo app',
      '',
      'Commands: `/plan <goal>`, `/tasks`, `/add <task>`, `/estimate`, `/launch`, `/usage`, `/help`.',
    ].join('\n'),
  )
}

// --- Router -----------------------------------------------------------------

export async function missionAgent(input, ctx) {
  const text = input.trim()
  const lower = text.toLowerCase()

  if (lower.startsWith('/')) {
    const [cmd, ...rest] = text.split(/\s+/)
    const arg = rest.join(' ')
    switch (cmd.toLowerCase()) {
      case '/plan':
        return arg ? proposePlan(arg, ctx) : ctx.say('Tell me the goal after `/plan`, e.g. `/plan a robot that folds clothes`.')
      case '/add':
        if (!planner.plan) return ctx.say('Create a plan first with `/plan <goal>`.')
        return arg ? addTasks([arg], ctx) : ctx.say('Tell me which task to add, e.g. `/add pairing socks`.')
      case '/tasks':
        if (!planner.plan) return ctx.say('No plan yet. Try `/plan a robot that folds clothes`.')
        planner.planCallId = ctx.tool('propose_tasks', { goal: 'current', ...snapshot(planner.plan) }, { status: 'current' }).toolCallId
        return ctx.say('Here is the current plan.')
      case '/estimate':
        return estimate(ctx)
      case '/launch':
        return launch(ctx)
      case '/usage':
        return usageReport(ctx)
      case '/help':
        return help(ctx)
      default:
        return ctx.say(`Unknown command \`${cmd}\`. Type \`/\` to see available commands.`)
    }
  }

  if (planner.plan && !planner.launchedMissionId) {
    // The plan and estimate cards' buttons send these exact messages; skip the model for them.
    if (/^approve and launch the mission\.$/.test(lower) && planner.estimate) return launch(ctx)
    if (/^looks good — approve the plan/.test(lower)) return estimate(ctx)
    if (/^i'd like to adjust the tasks first\.$/.test(lower)) {
      planner.estimate = null
      return ctx.say('Sure — edit the tasks in the plan card above, or tell me what to change, e.g. *“remove the cleaning task and double the grasping videos”*. Click **Approve plan** when you are done.')
    }
    if (!/^(help|what can you do)/.test(lower)) return revisePlan(text, ctx)
  }

  if (/^(help|what can you do)/.test(lower)) return help(ctx)
  if (/\b(usage|tokens?|how much have i used)\b/.test(lower) && !/robot/.test(lower)) return usageReport(ctx)
  return proposePlan(text, ctx)
}
