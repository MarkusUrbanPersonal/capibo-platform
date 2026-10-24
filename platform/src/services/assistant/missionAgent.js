import { planner, launchMission, setMissionStatus, resetPlanner } from '@/stores/missions'
import { PROCESSING_FEE } from '@/data/mock'

/**
 * Mock mission-planning agent. It decomposes a natural-language goal into
 * recordable video tasks, estimates cost, and dispatches tasks to the
 * Capibo mobile app. Responses are deterministic templates; replace
 * `missionAgent` with a call to your planning API when it exists.
 */

export const PLANNER_MODEL = 'capibo-planner-1'

// Slash commands in assistant-ui's shape (`id`, `description`, `icon`), grouped by `category`.
// `args` commands insert `/id ` for the user to finish; the rest run immediately.
export const SLASH_COMMANDS = [
  { id: 'plan', args: '<goal>', description: 'Break a robot goal into recordable video tasks', icon: 'sparkles', category: 'Plan' },
  { id: 'tasks', description: 'Show the current task plan', icon: 'list-checks', category: 'Plan' },
  { id: 'add', args: '<task>', description: 'Add a task to the current plan', icon: 'list-plus', category: 'Plan' },
  { id: 'estimate', description: 'Estimate cost and timeline for the plan', icon: 'calculator', category: 'Mission' },
  { id: 'launch', description: 'Dispatch the approved plan to collectors', icon: 'send', category: 'Mission' },
  { id: 'usage', description: 'Tokens and cost used by this conversation', icon: 'gauge', category: 'Conversation' },
  { id: 'help', description: 'What the mission planner can do', icon: 'help', category: 'Conversation' },
]

const DEFAULT_GUIDELINES = [
  'Chest- or head-mounted phone, landscape, 1080p or higher',
  'Both hands visible for the whole clip',
  'Neutral, well-lit surface; no faces in frame',
]

const TEMPLATES = [
  {
    match: /fold|cloth|laundry|garment|shirt|towel/i,
    name: 'Robotic clothes folding',
    objective: 'Egocentric demonstrations of picking, flattening and folding everyday garments to train a clothes-folding manipulation policy.',
    reasoning:
      'The goal is a clothes-folding robot. A folding policy needs the full manipulation sequence, not just the fold: grasping a garment out of a pile, laying it flat, folding per garment type (t-shirts, trousers and towels have different fold patterns), and placing the result on a stack. Each step has distinct hand poses and contact events, so recording them as separate clips gives cleaner labels and lets the robot team weight hard steps. T-shirt folding has the most variation, so it gets the largest share of videos.',
    tasks: [
      { name: 'Pick garment from pile', description: 'Reach into a mixed laundry pile and lift a single garment by its edge.', duration: [8, 18], videos: 400 },
      { name: 'Lay garment flat', description: 'Spread the garment flat on a table, front side up, and smooth out creases with both palms.', duration: [12, 25], videos: 700 },
      { name: 'Fold t-shirt', description: 'Fold sleeves in, then fold the shirt in thirds lengthwise.', duration: [20, 45], videos: 900 },
      { name: 'Fold trousers', description: 'Align the legs, fold in half lengthwise, then fold twice from the hem.', duration: [25, 50], videos: 650 },
      { name: 'Fold towel', description: 'Fold a bath or hand towel into quarters with edges aligned.', duration: [15, 35], videos: 450 },
      { name: 'Stack folded clothes', description: 'Place the folded item neatly on top of an existing stack.', duration: [6, 14], videos: 350 },
    ],
    followUps: ['pairing socks', 'hanging shirts on hangers', 'folding fitted sheets'],
  },
  {
    match: /dish|plate|kitchen|cutlery/i,
    name: 'Dish handling',
    objective: 'Demonstrations of picking, rinsing and loading dishes to train a kitchen manipulation policy.',
    reasoning:
      'Dish handling mixes rigid, fragile and small objects. I will separate grasping by object class (plates, glasses, cutlery) because grasp strategies differ, cover scraping and rinsing as pre-wash steps, and add rack placement as its own task because insertion into tines is the hardest contact-rich step.',
    tasks: [
      { name: 'Pick plate from sink', description: 'Grasp a plate from a sink with other dishes present.', duration: [6, 14], videos: 500 },
      { name: 'Scrape food scraps', description: 'Scrape leftovers from a plate into the bin with a fork or spatula.', duration: [6, 14], videos: 350 },
      { name: 'Rinse dish', description: 'Rinse front and back under running water.', duration: [10, 20], videos: 400 },
      { name: 'Load plate into rack', description: 'Insert the plate vertically between rack tines.', duration: [6, 14], videos: 600 },
      { name: 'Load glass upside down', description: 'Place a glass upside down on the top rack.', duration: [6, 12], videos: 450 },
      { name: 'Sort cutlery into basket', description: 'Drop forks, knives and spoons into separate basket slots.', duration: [10, 24], videos: 450 },
    ],
    followUps: ['unloading the dishwasher', 'stacking plates in a cupboard'],
  },
]

function genericTemplate(goal) {
  const object =
    goal
      .replace(/^(i\s+(want|need)\s+(to\s+)?)?(create|build|train|make)\s+(a|an)\s+robot\s+(that|which|to)\s+/i, '')
      .replace(/[.!?]+$/, '')
      .trim() || 'the target task'
  return {
    name: `Robot: ${object.charAt(0).toUpperCase()}${object.slice(1)}`.slice(0, 60),
    objective: `Egocentric demonstrations of people performing “${object}” end to end, segmented into recordable sub-tasks for policy training.`,
    reasoning: `The goal is a robot that ${object}. I will segment the behavior into approach, grasp, in-hand repositioning, the core manipulation, placement/reset and failure recovery. Separating these phases yields cleaner temporal labels and lets the core manipulation get the most coverage.`,
    tasks: [
      { name: 'Approach & inspect', description: `Walk up to the workspace and look over the items involved in “${object}”.`, duration: [6, 14], videos: 300 },
      { name: 'Grasp target object', description: 'Pick up the primary object with a natural, stable grasp.', duration: [6, 16], videos: 500 },
      { name: 'Reposition in hand', description: 'Adjust the grip or rotate the object into the working orientation.', duration: [5, 12], videos: 300 },
      { name: 'Perform core manipulation', description: `Carry out the main motion of “${object}” from start to finish.`, duration: [15, 45], videos: 900 },
      { name: 'Place & reset', description: 'Put the object in its final location and return hands to rest.', duration: [6, 14], videos: 400 },
      { name: 'Recover from a slip', description: 'Re-grasp the object after it slips or is dropped, then continue the task.', duration: [8, 20], videos: 250 },
    ],
    followUps: ['a cluttered-workspace variant', 'two-handed handovers'],
  }
}

const priceFor = (task) => {
  const avg = (task.duration[0] + task.duration[1]) / 2
  return Math.round((1.4 + avg * 0.055) * 100) / 100
}

function makePlan(goal) {
  const tpl = TEMPLATES.find((t) => t.match.test(goal)) ?? genericTemplate(goal)
  return {
    name: tpl.name,
    objective: tpl.objective,
    reasoning: tpl.reasoning,
    followUps: tpl.followUps,
    tasks: tpl.tasks.map((t, i) => ({
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
    videos: 400,
    guidelines: DEFAULT_GUIDELINES,
    enabled: true,
  }
  t.price = priceFor(t)
  return t
}

export function computeEstimate(plan) {
  const ACCEPT_RATE = 0.85
  const enabled = plan.tasks.filter((t) => t.enabled)
  const footageSeconds = enabled.reduce((s, t) => s + t.videos * ((t.duration[0] + t.duration[1]) / 2), 0)
  const lines = enabled
    .map((t) => ({
      name: t.name,
      videos: t.videos,
      price: t.price,
      subtotal: Math.round(t.videos * t.price * 100) / 100,
    }))
  const totalVideos = lines.reduce((s, l) => s + l.videos, 0)
  const collection = lines.reduce((s, l) => s + l.subtotal, 0)
  const expectedSubmissions = Math.round(totalVideos / ACCEPT_RATE)
  const processing = Math.round(expectedSubmissions * PROCESSING_FEE * 100) / 100
  const total = Math.round((collection + processing) * 100) / 100
  const collectors = Math.max(60, Math.round(totalVideos / 9.5))
  const days = Math.max(3, Math.ceil(expectedSubmissions / (collectors * 1.1)))
  return {
    lines,
    totalVideos,
    expectedSubmissions,
    acceptRate: ACCEPT_RATE,
    collection: Math.round(collection * 100) / 100,
    processing,
    total,
    avgPrice: Math.round((collection / Math.max(1, totalVideos)) * 100) / 100,
    collectors,
    days,
    hours: Math.round((footageSeconds / 3600) * 10) / 10,
  }
}

const fmtUsd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

// --- Agent work log ---------------------------------------------------------

/**
 * Emit an `agent_steps` tool call and run its steps one after another:
 * each step shows a spinner, then turns green with its final detail.
 */
async function runSteps(ctx, { title, doneTitle }, steps) {
  const started = Date.now()
  const result = {
    title,
    doneTitle,
    done: false,
    steps: steps.map((s) => ({ label: s.label, detail: s.running ?? '', status: 'pending' })),
  }
  const call = ctx.tool('agent_steps', { title }, snapshot(result))
  for (let i = 0; i < steps.length; i++) {
    result.steps[i].status = 'running'
    call.update({ result: snapshot(result) })
    await ctx.wait(steps[i].ms ?? 650)
    result.steps[i].status = 'done'
    result.steps[i].detail = steps[i].detail
    call.update({ result: snapshot(result) })
  }
  await ctx.wait(250)
  result.done = true
  result.elapsedMs = Date.now() - started
  call.update({ result: snapshot(result) })
}

// --- Intent handlers --------------------------------------------------------

async function proposePlan(goal, ctx) {
  resetPlanner()
  const plan = makePlan(goal)
  await ctx.think(plan.reasoning)
  const avgPrice = plan.tasks.reduce((s, t) => s + t.price, 0) / plan.tasks.length
  await runSteps(ctx, { title: 'Planning your mission', doneTitle: 'Mission planned' }, [
    { label: 'Understanding the goal', running: 'Reading your description…', detail: `Target behavior: ${plan.name.toLowerCase()}`, ms: 700 },
    { label: 'Searching the task library', running: 'Comparing with past missions…', detail: `${2 + (plan.tasks.length % 3)} similar missions · ${plan.tasks.length * 2 + 3} reference clips`, ms: 900 },
    { label: 'Breaking it into recordable tasks', running: 'Segmenting the behavior…', detail: `${plan.tasks.length} tasks drafted`, ms: 850 },
    { label: 'Checking collector availability', running: 'Querying US, PT and MX…', detail: 'US, PT, MX · 1,240 eligible collectors', ms: 750 },
    { label: 'Writing recording guidelines', running: 'Framing, lighting, privacy…', detail: `${DEFAULT_GUIDELINES.length} guidelines shared by all tasks`, ms: 600 },
    { label: 'Pricing each task', running: 'Scaling by clip length…', detail: `Avg. ${fmtUsd(avgPrice)} per accepted video`, ms: 600 },
  ])
  await ctx.say(`Here's how I'd break **${plan.name.toLowerCase()}** into videos your collectors can record. Each task is a separate clip type, so labels stay clean and you can weight the hard steps.`)

  // Stream the tasks into the plan card one at a time.
  planner.plan = { name: plan.name, objective: plan.objective, tasks: [] }
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
    `Review the tasks above: switch off anything you don't need, adjust video counts, or ask me to add more — for example *“add ${plan.followUps[0]}”*. When it looks right, click **Approve plan** and I'll prepare a cost estimate.`,
  )
}

async function addTasks(names, ctx) {
  await ctx.think(`The user wants additional coverage: ${names.join(', ')}. I'll add ${names.length > 1 ? 'these as separate tasks' : 'this as a separate task'} with a default of 400 videos and the standard recording guidelines, then re-issue the plan for review.`)
  const added = names.map((n, i) => makeTask(n, i))
  planner.plan.tasks.push(...added)
  planner.estimate = null
  const call = ctx.tool('propose_tasks', { goal: 'revision', ...snapshot(planner.plan) }, { status: 'revised', added: added.map((t) => t.name) })
  planner.planCallId = call.toolCallId
  await ctx.say(`Added **${added.map((t) => t.name).join('**, **')}**. The plan now has ${planner.plan.tasks.filter((t) => t.enabled).length} active tasks. Anything else, or shall I estimate the cost?`)
}

async function removeTask(query, ctx) {
  const task = planner.plan.tasks.find((t) => t.name.toLowerCase().includes(query.toLowerCase()))
  if (!task) {
    await ctx.say(`I couldn't find a task matching “${query}”. Current tasks: ${planner.plan.tasks.map((t) => t.name).join(', ')}.`)
    return
  }
  task.enabled = false
  planner.estimate = null
  const call = ctx.tool('propose_tasks', { goal: 'revision', ...snapshot(planner.plan) }, { status: 'revised', removed: [task.name] })
  planner.planCallId = call.toolCallId
  await ctx.say(`Removed **${task.name}** from the plan. You can switch it back on in the card above.`)
}

async function estimate(ctx) {
  if (!planner.plan) return ctx.say('There is no plan yet. Describe what your robot should learn, e.g. *“I want to create a robot that folds clothes.”*')
  const est = computeEstimate(planner.plan)
  if (est.totalVideos === 0) return ctx.say('All tasks are switched off. Enable at least one task to estimate a cost.')
  await runSteps(ctx, { title: 'Estimating cost', doneTitle: 'Estimate ready' }, [
    { label: 'Totalling footage', running: 'Summing clip lengths…', detail: `${est.hours} hours across ${est.lines.length} tasks`, ms: 600 },
    { label: 'Forecasting acceptance rate', running: 'Using similar missions…', detail: `${Math.round(est.acceptRate * 100)}% expected → ${est.expectedSubmissions.toLocaleString('en-US')} submissions`, ms: 750 },
    { label: 'Sizing the collector pool', running: 'Matching skills and regions…', detail: `${est.collectors} collectors · ~${est.days} days`, ms: 700 },
    { label: 'Checking your credit balance', running: 'Reading billing…', detail: 'Balance covers this mission', ms: 500 },
  ])
  await ctx.think(
    `Pricing per accepted video scales with clip length. With an expected acceptance rate of ${Math.round(est.acceptRate * 100)}%, ${est.totalVideos.toLocaleString('en-US')} accepted videos need about ${est.expectedSubmissions.toLocaleString('en-US')} submissions, each charged a $${PROCESSING_FEE.toFixed(2)} QA processing fee. Collector capacity in US, PT and MX supports ~${est.collectors} active collectors for this skill profile.`,
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
  const id = launchMission(planner.plan, est)
  planner.launchedMissionId = id
  await ctx.say(`Launching **${planner.plan.name}** as mission **${id}**.`)
  const steps = [
    { label: `Create mission ${id}`, detail: `${est.lines.length} tasks · ${est.totalVideos.toLocaleString('en-US')} video target` },
    { label: 'Generate recording guidelines', detail: 'Instructions and example frames per task' },
    { label: 'Localize instructions', detail: 'English, Spanish, Portuguese' },
    { label: 'Match collectors', detail: `Region, device and rating ≥ 4.6 → ${est.collectors} collectors` },
    { label: 'Push tasks to Capibo mobile app', detail: `0 / ${est.collectors} devices notified` },
    { label: 'Await first submissions', detail: 'QA pipeline armed' },
  ].map((s) => ({ ...s, status: 'pending' }))
  const result = { missionId: id, steps, notified: 0, collectors: est.collectors, done: false }
  const call = ctx.tool('dispatch_mission', { missionId: id, collectors: est.collectors }, snapshot(result))
  for (let i = 0; i < steps.length; i++) {
    result.steps[i].status = 'running'
    call.update({ result: snapshot(result) })
    if (i === 4) {
      for (let n = 0; n <= est.collectors; n += Math.ceil(est.collectors / 12)) {
        result.notified = Math.min(n, est.collectors)
        result.steps[i].detail = `${result.notified} / ${est.collectors} devices notified`
        call.update({ result: snapshot(result) })
        await ctx.wait(160)
      }
      result.notified = est.collectors
      result.steps[i].detail = `${est.collectors} / ${est.collectors} devices notified`
    } else {
      await ctx.wait(i === 5 ? 1600 : 700 + i * 120)
    }
    if (i === 5) result.steps[i].detail = 'First video received from C-58214 · in QA'
    result.steps[i].status = 'done'
    call.update({ result: snapshot(result) })
  }
  result.done = true
  call.update({ result: snapshot(result) })
  setMissionStatus(id, 'active')
  await ctx.say(`**${id} is live.** Tasks are on ${est.collectors} collectors' phones and the first video is already in quality review. You can follow progress under **Missions → Active**, and accepted videos will appear in **Datasets** as they pass QA.`)
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
    if (/\b(launch|dispatch|start|go live|send (it|them)|approve and launch)\b/.test(lower) && planner.estimate) return launch(ctx)
    if (/\b(approve|looks good|estimate|cost|price|budget|how much)\b/.test(lower)) return estimate(ctx)
    const remove = lower.match(/\b(?:remove|drop|delete|skip)\s+(?:the\s+)?(.+?)(?:\s+task)?[.!]?$/)
    if (remove) return removeTask(remove[1], ctx)
    const add = text.match(/\b(?:add|include|also)\s+(?:a\s+task\s+(?:for|of)\s+)?(.+?)[.!]?$/i)
    if (add) {
      const names = add[1].split(/,\s*|\s+and\s+/).map((s) => s.trim()).filter(Boolean)
      return addTasks(names, ctx)
    }
    if (/\badjust\b/.test(lower)) {
      planner.estimate = null
      return ctx.say('Sure — edit the tasks in the plan card above (toggle, rename video counts), or tell me what to add or remove. Click **Approve plan** when you are done.')
    }
  }

  if (/^(help|what can you do)/.test(lower)) return help(ctx)
  if (/\b(usage|tokens?|how much have i used)\b/.test(lower) && !/robot/.test(lower)) return usageReport(ctx)
  return proposePlan(text, ctx)
}
