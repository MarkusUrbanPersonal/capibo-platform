import { reactive } from 'vue'

/**
 * Token/cost meter shown in the assistant composer footer. It counts only real
 * model calls: each call reports the provider's token counts and cost through
 * `record`. Scripted replies (estimates, launches, help) use no tokens.
 */
export function createUsageMeter({ model, contextWindow = 1_048_576 }) {
  const state = reactive({
    model,
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    contextWindow,
    get tokens() {
      return state.inputTokens + state.outputTokens
    },
    get percent() {
      return Math.min(100, (state.tokens / state.contextWindow) * 100)
    },
    /** Adds one model call's usage: `{ model, inputTokens, outputTokens, cost }`. */
    record(call) {
      state.requests += 1
      state.inputTokens += call.inputTokens ?? 0
      state.outputTokens += call.outputTokens ?? 0
      state.cost += call.cost ?? 0
      if (call.model) state.model = call.model
    },
    reset() {
      Object.assign(state, { model, requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 })
    },
  })
  return state
}
