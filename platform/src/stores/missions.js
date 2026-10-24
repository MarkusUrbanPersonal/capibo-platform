import { computed, reactive } from 'vue'
import { missionsWithStats, isoDay, TODAY } from '@/data/mock'

/**
 * Client-side mission state: existing missions from the mock API plus
 * missions launched from the planner during this session, and the
 * planner's working draft (shared between the agent and its tool UIs).
 */
const state = reactive({
  launched: [],
  seeded: missionsWithStats.map((m) => ({ ...m })),
  planner: {
    plan: null, // { name, objective, tasks: [...] }
    planCallId: null, // tool call id of the plan card that is currently editable
    estimate: null,
    estimateCallId: null,
    launchedMissionId: null,
  },
})

export const planner = state.planner

export const allMissions = computed(() => [...state.launched, ...state.seeded])
export const launchedMissions = computed(() => state.launched)

export function resetPlanner() {
  Object.assign(state.planner, {
    plan: null,
    planCallId: null,
    estimate: null,
    estimateCallId: null,
    launchedMissionId: null,
  })
}

export function launchMission(plan, estimate) {
  const id = `MSN-${1049 + state.launched.length}`
  state.launched.unshift({
    id,
    name: plan.name,
    description: plan.objective,
    status: 'dispatching',
    start: isoDay(TODAY),
    end: null,
    target: estimate.totalVideos,
    pricePerVideo: estimate.avgPrice,
    regions: ['US', 'PT', 'MX'],
    tasks: plan.tasks.map((t, i) => ({ id: `T-${i + 1}`, name: t.name, labels: [] })),
    submitted: 0,
    processing: 0,
    processed: 0,
    accepted: 0,
    rejected: 0,
    cost: 0,
    progress: 0,
    isNew: true,
  })
  return id
}

export function setMissionStatus(id, status) {
  const m = allMissions.value.find((x) => x.id === id)
  if (m) m.status = status
}
