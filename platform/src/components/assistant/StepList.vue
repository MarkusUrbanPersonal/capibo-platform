<script setup>
import { computed } from 'vue'
import { Check, Circle, Loader2, X } from '@lucide/vue'

/**
 * Agent progress steps: a spinner while a step runs, a green check once it
 * is done, a red cross if it failed. With `reveal`, steps appear only when they start.
 */
const props = defineProps({
  steps: { type: Array, required: true }, // [{ label, detail?, status: 'pending' | 'running' | 'done' | 'error' }]
  reveal: { type: Boolean, default: false },
})

const visible = computed(() => (props.reveal ? props.steps.filter((s) => s.status !== 'pending') : props.steps))
</script>

<template>
  <ol class="relative space-y-3">
    <li v-for="(step, i) in visible" :key="step.label" class="rise-in relative flex items-start gap-3">
      <span
        v-if="i < visible.length - 1"
        class="absolute top-6 bottom-[-0.75rem] left-[9px] w-px transition-colors duration-500"
        :class="step.status === 'done' ? 'bg-emerald-500/40' : 'bg-border'"
        aria-hidden="true"
      />
      <span
        class="relative z-10 flex size-[19px] shrink-0 items-center justify-center rounded-full transition-all duration-300"
        :class="{
          'bg-emerald-500 text-white shadow-[0_0_0_3px] shadow-emerald-500/15': step.status === 'done',
          'bg-background text-foreground': step.status === 'running',
          'bg-background text-muted-foreground/50': step.status === 'pending',
          'bg-destructive text-white': step.status === 'error',
        }"
      >
        <Check v-if="step.status === 'done'" class="size-3" stroke-width="3" />
        <X v-else-if="step.status === 'error'" class="size-3" stroke-width="3" />
        <Loader2 v-else-if="step.status === 'running'" class="size-4 animate-spin" />
        <Circle v-else class="size-4" />
      </span>
      <div class="min-w-0 pt-px">
        <div
          class="text-sm transition-colors"
          :class="step.status === 'pending' ? 'text-muted-foreground' : step.status === 'running' ? 'font-medium shimmer-text' : 'font-medium'"
        >
          {{ step.label }}
        </div>
        <div v-if="step.detail" class="text-xs text-muted-foreground tabular-nums">{{ step.detail }}</div>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.shimmer-text {
  background: linear-gradient(90deg, var(--foreground) 35%, var(--muted-foreground) 50%, var(--foreground) 65%);
  background-size: 250% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: shimmer 1.6s linear infinite;
}
@keyframes shimmer {
  from { background-position: 100% 0; }
  to { background-position: -150% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .shimmer-text { animation: none; color: var(--foreground); background: none; }
}
</style>
