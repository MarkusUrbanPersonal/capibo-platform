import { createMockAgentRuntime } from './mockRuntime'
import { createUsageMeter } from './usage'

/**
 * One long-lived assistant per feature, so a conversation survives
 * navigation between pages. `agent` is the mock responder; to go live,
 * replace the runtime here with AISDKChat({ transport }) pointing at your API.
 */
const instances = new Map()

export function getAssistant(key, { agent, model, onReset } = {}) {
  if (!instances.has(key)) {
    const usage = createUsageMeter({ model })
    const { runtime, reset } = createMockAgentRuntime({ agent, usage })
    instances.set(key, {
      key,
      runtime,
      usage,
      reset() {
        reset()
        onReset?.()
      },
    })
  }
  return instances.get(key)
}

/** Clear a feature's conversation, if it has been started. */
export function resetAssistant(key) {
  instances.get(key)?.reset()
}
