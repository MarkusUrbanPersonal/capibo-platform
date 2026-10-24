import { computed, toValue } from 'vue'

/**
 * Vue port of assistant-ui's `unstable_useSlashCommandAdapter`
 * (https://www.assistant-ui.com/docs/guides/slash-commands). `@assistant-ui/vue`
 * doesn't ship the trigger-popover primitives yet, so this keeps the same contract:
 *
 * - `commands`: [{ id, label?, description?, icon?, category?, execute(item) }]
 *   (`label` defaults to `/${id}`; `icon` is a key into `iconMap`)
 * - `removeOnExecute`: strip the `/query` text instead of leaving a directive
 * - `iconMap` / `fallbackIcon`: icon components for the popover
 *
 * Returns `{ adapter, action, iconMap, fallbackIcon }` — spread it onto
 * `<ComposerTriggerPopover v-bind="slash" />`. `adapter` implements core's
 * `TriggerAdapter` (categories / categoryItems / search) over `TriggerItem`s.
 */
export function useSlashCommandAdapter(options) {
  const commands = computed(() => toValue(options.commands) ?? [])

  /** @returns {import('@assistant-ui/core').TriggerItem} */
  const toItem = (c) => ({
    id: c.id,
    type: 'command',
    label: c.label ?? `/${c.id}`,
    description: c.description,
    metadata: { icon: c.icon ?? '', args: c.args ?? '', category: c.category ?? '' },
  })

  /** @type {import('@assistant-ui/core').TriggerAdapter} */
  const adapter = {
    categories() {
      const seen = new Map()
      for (const c of commands.value) if (c.category && !seen.has(c.category)) seen.set(c.category, { id: c.category, label: c.category })
      return [...seen.values()]
    },
    categoryItems(categoryId) {
      return commands.value.filter((c) => (c.category ?? '') === categoryId).map(toItem)
    },
    search(query) {
      const q = query.toLowerCase()
      const starts = commands.value.filter((c) => c.id.startsWith(q))
      const contains = commands.value.filter((c) => !c.id.startsWith(q) && (c.id.includes(q) || c.description?.toLowerCase().includes(q)))
      return [...starts, ...contains].map(toItem)
    },
  }

  const action = {
    removeOnExecute: options.removeOnExecute ?? false,
    onExecute(item) {
      commands.value.find((c) => c.id === item.id)?.execute(item)
    },
  }

  return { adapter, action, iconMap: options.iconMap ?? {}, fallbackIcon: options.fallbackIcon }
}
