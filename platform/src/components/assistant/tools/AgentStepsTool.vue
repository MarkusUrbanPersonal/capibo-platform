<script setup>
import { computed, ref } from 'vue'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { useAuiState } from '@assistant-ui/vue'
import { CheckCircle2, ChevronDown, CircleSlash, Loader2 } from '@lucide/vue'
import StepList from '../StepList.vue'

// Live agent work log: steps load, then turn green. Collapses once finished.
const props = defineProps({
  tool: { type: Object, required: true },
})

const r = computed(() => props.tool.part.result ?? { steps: [] })
const isRunning = useAuiState((s) => s.thread.isRunning)
const done = computed(() => r.value.done)
const stopped = computed(() => !done.value && !isRunning.value)
const finished = computed(() => r.value.steps.filter((s) => s.status === 'done').length)
const userOpen = ref(null)
const open = computed(() => userOpen.value ?? !(done.value || stopped.value))
const seconds = computed(() => (r.value.elapsedMs ? (r.value.elapsedMs / 1000).toFixed(1) : null))
</script>

<template>
  <CollapsibleRoot
    :open="open"
    class="rise-in my-3 w-full overflow-hidden rounded-xl border bg-card"
    @update:open="(v) => (userOpen = v)"
  >
    <CollapsibleTrigger class="group/trigger flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm">
      <CheckCircle2 v-if="done" class="size-4 shrink-0 text-emerald-500" />
      <CircleSlash v-else-if="stopped" class="size-4 shrink-0 text-muted-foreground" />
      <Loader2 v-else class="size-4 shrink-0 animate-spin text-muted-foreground" />
      <span class="font-medium">{{ done ? r.doneTitle ?? r.title : stopped ? 'Stopped' : r.title }}</span>
      <span class="text-xs text-muted-foreground tabular-nums">
        {{ finished }}/{{ r.steps.length }} steps<template v-if="done && seconds"> · {{ seconds }}s</template>
      </span>
      <ChevronDown class="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]/trigger:-rotate-90" />
    </CollapsibleTrigger>
    <CollapsibleContent class="steps-content overflow-hidden">
      <div class="border-t px-3.5 py-3">
        <StepList :steps="r.steps" reveal />
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>

<style scoped>
.steps-content[data-state='open'] { animation: steps-down 220ms cubic-bezier(0.32, 0.72, 0, 1); }
.steps-content[data-state='closed'] { animation: steps-up 220ms cubic-bezier(0.32, 0.72, 0, 1); }
@keyframes steps-down { from { height: 0; } to { height: var(--reka-collapsible-content-height); } }
@keyframes steps-up { from { height: var(--reka-collapsible-content-height); } to { height: 0; } }
</style>
