import {
  AssistantRuntimeImpl,
  ExternalStoreRuntimeCore,
} from '@assistant-ui/core/internal'

/**
 * A mock agent runtime for assistant-ui Vue, built on the documented
 * ExternalStore runtime (https://www.assistant-ui.com/docs/vue/external-store).
 *
 * The store owns messages in assistant-ui's ThreadMessageLike shape. An
 * "agent" is an async function `(text, ctx) => void` that streams reasoning,
 * text and tool calls into the in-progress assistant message through `ctx`.
 * Agents that call a model report its real token usage via `ctx.usage.record`.
 * To connect a real backend later, swap this runtime for `AISDKChat()` (or
 * implement `agent` with a fetch to your API) — the UI does not change.
 */

let nextId = 0
const freshId = (prefix) => `${prefix}-${Date.now().toString(36)}-${nextId++}`

const messageText = (message) =>
  message.content.map((part) => (part.type === 'text' ? part.text : '')).join('')

class CancelledError extends Error {}

export function createMockAgentRuntime({ agent, usage, suggestions = [] }) {
  let messages = []
  let isRunning = false
  let controller = null

  const replaceLast = (updater) => {
    const last = messages[messages.length - 1]
    messages = [...messages.slice(0, -1), updater(last)]
  }

  const makeContext = (signal) => {
    const check = () => {
      if (signal.aborted) throw new CancelledError()
    }
    const wait = (ms) =>
      new Promise((resolve, reject) => {
        const t = setTimeout(resolve, ms)
        signal.addEventListener('abort', () => {
          clearTimeout(t)
          reject(new CancelledError())
        })
      })
    const pushPart = (part) => {
      check()
      replaceLast((m) => ({ ...m, content: [...m.content, part] }))
      sync()
      return messages[messages.length - 1].content.length - 1
    }
    const patchPart = (index, patch) => {
      check()
      replaceLast((m) => {
        const content = [...m.content]
        content[index] = { ...content[index], ...patch }
        return { ...m, content }
      })
      sync()
    }
    // Stream text into a part in word-sized chunks, like a token stream.
    const stream = async (type, text, speed = 14) => {
      const index = pushPart({ type, text: '' })
      const tokens = text.match(/\s*\S+/g) ?? []
      let acc = ''
      for (const token of tokens) {
        acc += token
        patchPart(index, { text: acc })
        await wait(speed + Math.random() * speed)
      }
      return index
    }
    return {
      signal,
      wait,
      usage,
      think: (text, speed = 8) => stream('reasoning', text, speed),
      say: (text, speed) => stream('text', text, speed),
      /** Emit a tool call; returns a handle to update its args/result while it runs. */
      tool: (toolName, args, result) => {
        const toolCallId = freshId('call')
        const index = pushPart({
          type: 'tool-call',
          toolCallId,
          toolName,
          args,
          argsText: JSON.stringify(args),
          result,
        })
        return {
          toolCallId,
          update: (patch) =>
            patchPart(index, {
              ...(patch.args ? { args: patch.args, argsText: JSON.stringify(patch.args) } : {}),
              ...('result' in patch ? { result: patch.result } : {}),
            }),
        }
      },
    }
  }

  const run = async (text) => {
    controller = new AbortController()
    const { signal } = controller
    isRunning = true
    messages = [
      ...messages,
      { id: freshId('assistant'), role: 'assistant', content: [], status: { type: 'running' } },
    ]
    sync()
    try {
      await agent(text, makeContext(signal), { messages })
      replaceLast((m) => ({ ...m, status: { type: 'complete', reason: 'stop' } }))
    } catch (err) {
      if (err instanceof CancelledError) {
        replaceLast((m) => ({ ...m, status: { type: 'incomplete', reason: 'cancelled' } }))
      } else {
        console.error(err)
        replaceLast((m) => ({ ...m, status: { type: 'incomplete', reason: 'error', error: String(err) } }))
      }
    } finally {
      isRunning = false
      controller = null
      sync()
    }
  }

  const appendUser = (text) => {
    messages = [
      ...messages,
      { id: freshId('user'), role: 'user', content: [{ type: 'text', text }], createdAt: new Date() },
    ]
  }

  const makeAdapter = () => ({
    messages,
    isRunning,
    suggestions,
    convertMessage: (m) => m,
    setMessages: (next) => {
      messages = [...next]
      sync()
    },
    onNew: async (message) => {
      const text = messageText(message)
      appendUser(text)
      sync()
      await run(text)
    },
    onReload: async (parentId) => {
      const index = parentId ? messages.findIndex((m) => m.id === parentId) : -1
      const sliced = messages.slice(0, index + 1)
      const lastUser = [...sliced].reverse().find((m) => m.role === 'user')
      messages = sliced
      sync()
      if (lastUser) await run(messageText(lastUser))
    },
    onCancel: async () => {
      controller?.abort()
    },
  })

  const core = new ExternalStoreRuntimeCore(makeAdapter())
  const sync = () => core.setAdapter(makeAdapter())
  const runtime = new AssistantRuntimeImpl(core)

  return {
    runtime,
    reset() {
      controller?.abort()
      messages = []
      isRunning = false
      usage?.reset()
      sync()
    },
  }
}
