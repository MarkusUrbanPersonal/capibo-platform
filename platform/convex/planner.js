import { action, env } from './_generated/server'
import { components } from './_generated/api'
import { ConvexError, v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { RateLimiter, MINUTE } from '@convex-dev/rate-limiter'
import { ICON_NAMES, isTone, TONE_NAMES } from './lib/visuals'

// The mission planner's model calls: `planMission` turns a goal into 4 or 6
// filmable tasks, and `editPlan` applies a free-form revision ("drop the
// eating task", "double the grasping videos") to the current plan. OpenAI is
// tried first, Gemini is the fallback. Keys live in the deployment's
// environment (`npx convex env set OPENAI_API_KEY ...`) and never reach the browser.

const OPENAI_MODEL = () => env.OPENAI_MODEL || 'gpt-5.4-mini'
// Fastest first: 3.5 Flash-Lite answers in ~1s.
const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite']
// USD per 1M tokens. Output includes reasoning/thinking tokens.
const PRICES = {
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },
  'gemini-3-flash-preview': { input: 0.5, output: 3 },
  'gemini-3.5-flash-lite': { input: 0.3, output: 2.5 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
}
const TIMEOUT_MS = 45_000

const rateLimiter = new RateLimiter(components.rateLimiter, {
  missionPlans: { kind: 'token bucket', rate: 10, period: MINUTE, capacity: 5 },
  planEdits: { kind: 'token bucket', rate: 30, period: MINUTE, capacity: 10 },
})

const CONTEXT = `You plan data-collection missions for Capibo, a platform where everyday people film first-person (egocentric) videos with a chest- or head-mounted phone to train robot manipulation policies.`

const TASK_RULES = `Each task is one short clip type a collector records in a single take. Tasks must be:
- Convenient to film at home or in a typical workplace by an ordinary person, with common objects and no special equipment, permits or risk.
- Concrete and visual: a hand-object interaction with a clear start and end, both hands visible, no faces.
- Distinct from each other.

For each task give a short verb-first name (max 40 characters), collector instructions (1-2 sentences, second person), a realistic clip length range in seconds, and a video target (10 to 300, in multiples of 10; most tasks need 20 to 100; give more to the hardest, most varied steps).
Pick an icon and a tone for each task. The icon must depict the object or action of the task as literally as possible and must be exactly one of these names: ${ICON_NAMES.join(', ')}. If none fits closely, use the nearest general one (Hand, Grab, Move, Eye). Vary the tones across tasks so neighbouring tiles look distinct.`

const PLAN_PROMPT = `${CONTEXT}

First decide whether the message describes something a robot should learn or do (a behavior, skill or task, however loosely worded). If it does not (a greeting, an unrelated question, small talk, gibberish), set "understood" to false, write "clarification" as one short, friendly sentence that starts with "I didn't get" and says what you didn't understand (e.g. "I didn't get what you'd like your robot to learn from “what's the weather today”."), and leave every other string empty and every array empty. Otherwise set "understood" to true and "clarification" to an empty string.

Given what a customer wants their robot to learn, break it into an even number of tasks: 4 or 6 (prefer 4 for simple behaviors, 6 for complex ones; never 3 or 5), because tasks are shown in a two-column grid. Together the tasks cover the behavior end to end (e.g. grasp, manipulate, place, recover from a mistake).

${TASK_RULES}
Also pick an icon and a tone for the whole mission.
Write "reasoning" as 2-4 sentences explaining how you segmented the behavior and why. "followUps" are 2-3 short task ideas the customer could add later.`

const EDIT_PROMPT = `${CONTEXT}

You are revising a mission plan with the customer. You get the current plan as JSON (each task has an "id"; "enabled": false means the task is switched off) and the customer's latest message. Set "intent" to what they want:
- "edit": change the plan. Match tasks by meaning, not exact wording ("the eating and cleaning tasks" → the tasks about eating and cleaning). Put the ids of tasks to switch off in "remove". Put changes to existing tasks in "update", with null for every field that stays the same (set "enabled" to true to switch a task back on; compute relative changes like "double the videos" from the current numbers). Put new tasks in "add".
- "estimate": they approve the plan or ask about cost, price, budget or timeline.
- "launch": they want to launch or dispatch the mission now.
- "new_plan": they describe a different robot goal that the current plan doesn't cover, so the plan should start over.
- "question": they ask something about the plan or about Capibo; answer it in "reply".
- "unclear": the message is unrelated or can't be understood; "reply" starts with "I didn't get" and says what you didn't understand.
Leave "remove", "update" and "add" empty unless the intent is "edit". Apply edits directly; never ask for confirmation. If something they refer to doesn't exist in the plan, say so in "reply" and change nothing for it.
"reply" is 1-2 short sentences in Markdown telling the customer what you did (task names in **bold**) or answering them.

Rules for new tasks:
${TASK_RULES}`

// --- Response schemas (JSON Schema, strict: every key required, no extra keys) ---

const str = { type: 'string' }
const int = { type: 'integer' }
const nullable = (type) => ({ type: [type, 'null'] })
const object = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })

// Icons are listed in the prompt and checked in `iconFor`: Gemini rejects an enum as long as the icon list.
const TASK = object({ name: str, description: str, minSeconds: int, maxSeconds: int, videos: int, icon: str, tone: { type: 'string', enum: TONE_NAMES } })

const PLAN_SCHEMA = object({
  understood: { type: 'boolean' },
  clarification: str,
  reasoning: str,
  name: { type: 'string', description: 'Mission title, max 60 characters' },
  objective: { type: 'string', description: 'One sentence: what the footage is for' },
  icon: str,
  tone: { type: 'string', enum: TONE_NAMES },
  tasks: { type: 'array', items: TASK },
  followUps: { type: 'array', items: str },
})

const EDIT_SCHEMA = object({
  intent: { type: 'string', enum: ['edit', 'estimate', 'launch', 'new_plan', 'question', 'unclear'] },
  reply: str,
  remove: { type: 'array', items: str },
  update: {
    type: 'array',
    items: object({
      id: str,
      name: nullable('string'),
      description: nullable('string'),
      minSeconds: nullable('integer'),
      maxSeconds: nullable('integer'),
      videos: nullable('integer'),
      enabled: nullable('boolean'),
    }),
  },
  add: { type: 'array', items: TASK },
})

// --- Normalizing model output ---------------------------------------------

const ICON_BY_LOWER = new Map(ICON_NAMES.map((n) => [n.toLowerCase(), n]))
// An icon from the vocabulary, or null so the platform falls back to keyword matching on the name.
const iconFor = (s) => ICON_BY_LOWER.get(String(s ?? '').trim().toLowerCase()) ?? null

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(n) || lo)))
const text = (s, max) => String(s ?? '').trim().slice(0, max)
const roundVideos = (n) => clamp(Math.round((Number(n) || 50) / 10) * 10, 10, 300)

function normalizeTask(t) {
  const min = clamp(t.minSeconds, 3, 300)
  const max = clamp(t.maxSeconds, min, 600)
  return {
    name: text(t.name, 60) || 'Untitled task',
    description: text(t.description, 600),
    duration: [min, max],
    videos: roundVideos(t.videos),
    icon: iconFor(t.icon),
    tone: isTone(t.tone) ? t.tone : TONE_NAMES[0],
  }
}

/** Model output → a plan the planner UI and `missions.create` accept, whatever the model returned. */
function normalizePlan(raw) {
  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : []).slice(0, 6).map(normalizeTask)
  if (tasks.length === 0) throw new ConvexError('The planning model returned no tasks. Please try again.')
  return {
    name: text(raw.name, 60) || 'Untitled mission',
    objective: text(raw.objective, 400),
    reasoning: text(raw.reasoning, 2000),
    icon: iconFor(raw.icon),
    tone: isTone(raw.tone) ? raw.tone : 'blue',
    followUps: (Array.isArray(raw.followUps) ? raw.followUps : []).map((s) => text(s, 80)).filter(Boolean).slice(0, 3),
    tasks,
  }
}

/** Model output → edits that only reference tasks that exist in `plan`. */
function normalizeEdit(raw, plan) {
  const ids = new Set(plan.tasks.map((t) => t.id))
  const intent = ['edit', 'estimate', 'launch', 'new_plan', 'question', 'unclear'].includes(raw.intent) ? raw.intent : 'unclear'
  const edit = intent === 'edit'
  const list = (a) => (edit && Array.isArray(a) ? a : [])
  return {
    intent,
    reply: text(raw.reply, 600),
    remove: list(raw.remove).filter((id) => ids.has(id)),
    update: list(raw.update)
      .filter((u) => ids.has(u?.id))
      .map((u) => {
        const current = plan.tasks.find((t) => t.id === u.id)
        const min = u.minSeconds == null ? current.duration[0] : clamp(u.minSeconds, 3, 300)
        const max = u.maxSeconds == null ? Math.max(min, current.duration[1]) : clamp(u.maxSeconds, min, 600)
        return {
          id: u.id,
          ...(u.name ? { name: text(u.name, 60) } : {}),
          ...(u.description ? { description: text(u.description, 600) } : {}),
          ...(min !== current.duration[0] || max !== current.duration[1] ? { duration: [min, max] } : {}),
          ...(u.videos == null ? {} : { videos: roundVideos(u.videos) }),
          ...(typeof u.enabled === 'boolean' ? { enabled: u.enabled } : {}),
        }
      }),
    add: list(raw.add).slice(0, 10).map(normalizeTask),
  }
}

// --- Providers ----------------------------------------------------------------

const costOf = (model, inputTokens, outputTokens) => {
  const price = PRICES[model] ?? PRICES[Object.keys(PRICES).find((k) => model.startsWith(k))] ?? { input: 0, output: 0 }
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

async function post(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS), body: JSON.stringify(body) })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

async function openai(model, key, { system, user, schema, name }) {
  const { status, body } = await post('https://api.openai.com/v1/chat/completions', { authorization: `Bearer ${key}` }, {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
    reasoning_effort: env.OPENAI_REASONING_EFFORT || 'low',
  })
  if (status !== 200) return { status, error: body?.error?.message ?? `HTTP ${status}` }
  const u = body.usage ?? {}
  return {
    json: body.choices?.[0]?.message?.content,
    usage: { model: body.model ?? model, inputTokens: u.prompt_tokens ?? 0, outputTokens: u.completion_tokens ?? 0, thoughtsTokens: u.completion_tokens_details?.reasoning_tokens ?? 0 },
  }
}

async function gemini(model, key, { system, user, schema }) {
  const { status, body } = await post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { 'x-goog-api-key': key }, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    // Default (high) thinking spends ~1,300 tokens and ~9s before answering; low is plenty here.
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.7, thinkingConfig: { thinkingLevel: 'low' } },
  })
  if (status !== 200) return { status, error: body?.error?.message ?? `HTTP ${status}` }
  const meta = body.usageMetadata ?? {}
  return {
    json: body.candidates?.[0]?.content?.parts?.find((p) => p.text && !p.thought)?.text,
    usage: { model: body.modelVersion ?? model, inputTokens: meta.promptTokenCount ?? 0, outputTokens: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0), thoughtsTokens: meta.thoughtsTokenCount ?? 0 },
  }
}

/**
 * Runs one structured-output call, trying OpenAI (if configured) and then each
 * Gemini model until one answers. Returns `{ raw, usage }` with the parsed JSON.
 */
async function generate(request) {
  const attempts = [
    ...(env.OPENAI_API_KEY ? [[openai, OPENAI_MODEL(), env.OPENAI_API_KEY]] : []),
    ...(env.GEMINI_API_KEY ? GEMINI_MODELS.map((m) => [gemini, m, env.GEMINI_API_KEY]) : []),
  ]
  if (attempts.length === 0) throw new ConvexError('The planning model is not configured (OPENAI_API_KEY is missing).')

  let lastError = 'no model responded'
  for (const [provider, model, key] of attempts) {
    let result
    try {
      result = await provider(model, key, request)
    } catch (e) {
      lastError = e?.name === 'TimeoutError' ? `${model} timed out` : String(e)
      continue
    }
    // Any failure (overloaded, quota, rejected) moves on to the next model.
    if (result.error) {
      lastError = result.error
      continue
    }
    try {
      const raw = JSON.parse(result.json)
      return { raw, usage: { ...result.usage, cost: costOf(result.usage.model, result.usage.inputTokens, result.usage.outputTokens) } }
    } catch {
      lastError = `${model} returned malformed JSON`
    }
  }
  throw new ConvexError(`The planning model is unavailable right now (${lastError}). Please try again in a moment.`)
}

async function guard(ctx, limit) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError('Not signed in')
  const { ok, retryAfter } = await rateLimiter.limit(ctx, limit, { key: userId })
  if (!ok) throw new ConvexError(`Too many requests in a short time. Try again in ${Math.ceil(retryAfter / 1000)} seconds.`)
}

/**
 * Plans a mission from a goal. Returns `{ plan, usage }`, where usage is the call's real token count and cost.
 * When the goal isn't about a robot behavior, `plan` is null and `clarification` says what wasn't understood.
 */
export const planMission = action({
  args: { goal: v.string() },
  handler: async (ctx, { goal }) => {
    const trimmed = goal.trim().slice(0, 2000)
    if (!trimmed) throw new ConvexError('Describe what your robot should learn.')
    await guard(ctx, 'missionPlans')
    const { raw, usage } = await generate({ name: 'mission_plan', system: PLAN_PROMPT, user: `What the robot should learn: ${trimmed}`, schema: PLAN_SCHEMA })
    const understood = raw.understood !== false
    return {
      plan: understood ? normalizePlan(raw) : null,
      ...(understood ? {} : { clarification: text(raw.clarification, 300) || "I didn't get what you'd like your robot to learn." }),
      usage,
    }
  },
})

/**
 * Interprets a message about the current plan. Returns `{ edit, usage }`, where
 * `edit` is `{ intent, reply, remove, update, add }`; only "edit" carries changes.
 */
export const editPlan = action({
  args: {
    message: v.string(),
    plan: v.object({
      name: v.string(),
      objective: v.string(),
      tasks: v.array(
        v.object({ id: v.string(), name: v.string(), description: v.string(), duration: v.array(v.number()), videos: v.number(), enabled: v.boolean() }),
      ),
    }),
  },
  handler: async (ctx, { message, plan }) => {
    const trimmed = message.trim().slice(0, 2000)
    if (!trimmed) throw new ConvexError('Tell me what to change.')
    if (plan.tasks.length > 60) throw new ConvexError('This plan has too many tasks to edit.')
    await guard(ctx, 'planEdits')
    const current = {
      name: plan.name,
      objective: plan.objective,
      tasks: plan.tasks.map((t) => ({ id: t.id, name: t.name, description: t.description, minSeconds: t.duration[0], maxSeconds: t.duration[1], videos: t.videos, enabled: t.enabled })),
    }
    const { raw, usage } = await generate({
      name: 'plan_edit',
      system: EDIT_PROMPT,
      user: `Current plan:\n${JSON.stringify(current)}\n\nCustomer: ${trimmed}`,
      schema: EDIT_SCHEMA,
    })
    return { edit: normalizeEdit(raw, plan), usage }
  },
})
