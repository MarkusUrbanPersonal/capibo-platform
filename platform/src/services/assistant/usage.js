import { reactive } from 'vue'

/** Token/cost meter shown in the assistant composer footer (mocked). */
export function createUsageMeter({ model, contextWindow = 200_000, costPerKTokens = 0.006 }) {
  const state = reactive({
    model,
    tokens: 0,
    contextWindow,
    get cost() {
      return (state.tokens / 1000) * costPerKTokens
    },
    get percent() {
      return Math.min(100, (state.tokens / state.contextWindow) * 100)
    },
    add(n) {
      // A system prompt + tool schemas are "sent" with the first message.
      if (state.tokens === 0) state.tokens += 1840
      state.tokens += n
    },
    reset() {
      state.tokens = 0
    },
  })
  return state
}
