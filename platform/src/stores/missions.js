import { computed, effectScope, reactive } from 'vue'
import { api } from '@convex/_generated/api'
import { convex, useQuery } from '@/lib/convex'
import { auth } from '@/stores/auth'

/**
 * The organization's missions, kept live from Convex for the lifetime of the
 * app (undefined while loading), plus the mission planner's working draft
 * (shared between the agent and its tool UIs).
 */
const { data } = effectScope(true).run(() => useQuery(api.missions.list, () => (auth.isAuthenticated ? {} : 'skip')))

export const missionsLoaded = computed(() => data.value !== undefined)
export const allMissions = computed(() => data.value ?? [])

export const planner = reactive({
  plan: null, // { name, objective, icon, tone, tasks: [...] }
  planCallId: null, // tool call id of the plan card that is currently editable
  estimate: null,
  estimateCallId: null,
  launchedMissionId: null,
})

export function resetPlanner() {
  Object.assign(planner, {
    plan: null,
    planCallId: null,
    estimate: null,
    estimateCallId: null,
    launchedMissionId: null,
  })
}

// Collection runs in the US only for now.
const DEFAULT_REGIONS = ['US']

/** Creates and dispatches the planned mission. Returns its id; throws if the balance doesn't cover it. */
export function launchMission(plan, guidelines) {
  return convex.mutation(api.missions.create, {
    name: plan.name,
    description: plan.objective,
    regions: DEFAULT_REGIONS,
    guidelines,
    ...(plan.icon ? { icon: plan.icon } : {}),
    ...(plan.tone ? { tone: plan.tone } : {}),
    tasks: plan.tasks
      .filter((t) => t.enabled)
      .map((t) => ({
        name: t.name,
        instructions: t.description,
        videos: t.videos,
        duration: t.duration,
        ...(t.icon ? { icon: t.icon } : {}),
        ...(t.tone ? { tone: t.tone } : {}),
      })),
  })
}

export const setMissionStatus = (id, status) => convex.mutation(api.missions.setStatus, { id, status })
export const deleteMission = (id) => convex.mutation(api.missions.remove, { id })
