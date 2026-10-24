<script setup>
import { computed, ref, watch } from 'vue'
import { useAui, useAuiState } from '@assistant-ui/vue'
import { defaultDirectiveFormatter } from '@assistant-ui/core'
import { SquareSlash } from '@lucide/vue'

/**
 * Slash-command popover for the composer, modeled on assistant-ui's
 * `ComposerPrimitive.TriggerPopover` + `.Action` (React-only for now).
 * Opens when the composer text is `${char}query`; Arrow keys / Tab / Enter pick,
 * Escape dismisses. Selecting runs `action.onExecute(item)` and, unless
 * `removeOnExecute`, leaves a directive (`:command[/x]{name=x}`) in the text.
 *
 * The parent forwards keydown (capture phase) via the exposed `onKeydown`.
 */
const props = defineProps({
  adapter: { type: Object, required: true },
  action: { type: Object, required: true },
  iconMap: { type: Object, default: () => ({}) },
  fallbackIcon: { type: [Object, Function], default: () => SquareSlash },
  char: { type: String, default: '/' },
  formatter: { type: Object, default: () => defaultDirectiveFormatter },
  id: { type: String, default: 'slash-commands' },
})

const aui = useAui()
const text = useAuiState((s) => s.composer.text)
const index = ref(0)
const dismissed = ref(false)

const escaped = computed(() => props.char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
const query = computed(() => (new RegExp(`^${escaped.value}\\S*$`).test(text.value) ? text.value.slice(props.char.length) : null))

// Empty query: every command, grouped by category. Otherwise: ranked search results.
const groups = computed(() => {
  if (query.value === null) return []
  if (query.value === '') {
    const cats = props.adapter.categories()
    if (!cats.length) return [{ id: '', label: 'Commands', items: props.adapter.search('') }]
    return cats.map((c) => ({ ...c, items: props.adapter.categoryItems(c.id) })).filter((g) => g.items.length)
  }
  const items = props.adapter.search(query.value)
  return items.length ? [{ id: '', label: 'Commands', items }] : []
})
const flat = computed(() => groups.value.flatMap((g) => g.items))
const open = computed(() => !dismissed.value && flat.value.length > 0)

watch(query, (q) => {
  index.value = 0
  if (q === null) dismissed.value = false
})

const iconFor = (item) => props.iconMap[item.metadata?.icon] ?? props.fallbackIcon
const optionId = (item) => `${props.id}-${item.id}`

function select(item) {
  if (!props.action.removeOnExecute) aui.composer.setText(props.formatter.serialize(item) + ' ')
  else aui.composer.setText('')
  props.action.onExecute(item)
}

function onKeydown(e) {
  if (!open.value) return
  const n = flat.value.length
  if (e.key === 'ArrowDown') index.value = (index.value + 1) % n
  else if (e.key === 'ArrowUp') index.value = (index.value - 1 + n) % n
  else if (e.key === 'Enter' || e.key === 'Tab') select(flat.value[index.value])
  else if (e.key === 'Escape') dismissed.value = true
  else return
  e.preventDefault()
  e.stopPropagation()
}

/** Opens the popover by typing the trigger character into the composer. */
function openPopover() {
  dismissed.value = false
  aui.composer.setText(props.char)
}

defineExpose({
  onKeydown,
  open: openPopover,
  isOpen: open,
  activeId: computed(() => (open.value && flat.value[index.value] ? optionId(flat.value[index.value]) : undefined)),
})
</script>

<template>
  <div
    v-if="open"
    class="absolute inset-x-0 bottom-full z-30 mb-2 max-h-[26rem] overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 slide-in-from-bottom-1 duration-150"
  >
    <div :id="id" role="listbox" aria-label="Slash commands">
      <div v-for="g in groups" :key="g.id" role="group" :aria-label="g.label">
        <div class="px-2 pt-1.5 pb-0.5 text-[11px] font-medium text-muted-foreground">{{ g.label }}</div>
        <div
          v-for="item in g.items"
          :id="optionId(item)"
          :key="item.id"
          role="option"
          :aria-selected="flat[index]?.id === item.id"
          class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 text-sm"
          :class="flat[index]?.id === item.id ? 'bg-accent text-accent-foreground' : ''"
          @mouseenter="index = flat.indexOf(item)"
          @mousedown.prevent="select(item)"
        >
          <span class="flex size-6 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
            <component :is="iconFor(item)" class="size-3.5" aria-hidden="true" />
          </span>
          <span class="shrink-0 font-medium">{{ item.label }}</span>
          <span v-if="item.metadata?.args" class="shrink-0 font-mono text-[11px] text-muted-foreground">{{ item.metadata.args }}</span>
          <span v-if="item.description" class="ml-auto truncate pl-2 text-xs text-muted-foreground">{{ item.description }}</span>
        </div>
      </div>
    </div>
    <div class="mt-1 flex gap-3 border-t px-2 pt-1.5 pb-1 text-[11px] text-muted-foreground">
      <span><kbd class="font-sans">↑↓</kbd> navigate</span>
      <span><kbd class="font-sans">↵</kbd> select</span>
      <span><kbd class="font-sans">esc</kbd> close</span>
    </div>
  </div>
</template>
