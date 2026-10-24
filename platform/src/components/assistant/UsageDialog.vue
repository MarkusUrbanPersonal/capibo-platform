<script setup>
import { computed } from 'vue'
import { useAuiState } from '@assistant-ui/vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCompact, formatNumber } from '@/lib/format'

// Usage report for the current conversation, opened by the `/usage` command (mocked).
const open = defineModel('open', { type: Boolean, default: false })
const props = defineProps({
  usage: { type: Object, required: true },
})

const messages = useAuiState((s) => s.thread.messages.length)

const R = 26
const C = 2 * Math.PI * R
const dash = computed(() => `${(Math.max(props.usage.percent, props.usage.tokens ? 1 : 0) / 100) * C} ${C}`)

const rows = computed(() => [
  { label: 'Model', value: props.usage.model, mono: true },
  { label: 'Messages', value: formatNumber(messages.value) },
  { label: 'Tokens used', value: formatNumber(props.usage.tokens) },
  { label: 'Context window', value: formatNumber(props.usage.contextWindow) },
  { label: 'Session cost', value: `$${props.usage.cost.toFixed(4)}` },
])
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="gap-5 sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Usage</DialogTitle>
        <DialogDescription>Tokens and cost for this conversation. Billed separately from video credits.</DialogDescription>
      </DialogHeader>

      <div class="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
        <div class="relative size-16 shrink-0">
          <svg viewBox="0 0 64 64" class="size-16 -rotate-90" aria-hidden="true">
            <circle cx="32" cy="32" :r="R" fill="none" stroke="currentColor" stroke-opacity="0.12" stroke-width="6" />
            <circle
              cx="32"
              cy="32"
              :r="R"
              fill="none"
              stroke="currentColor"
              stroke-width="6"
              stroke-linecap="round"
              :stroke-dasharray="dash"
              class="text-primary transition-[stroke-dasharray] duration-500"
            />
          </svg>
          <span class="absolute inset-0 flex items-center justify-center text-xs font-medium tabular-nums">{{ usage.percent.toFixed(1) }}%</span>
        </div>
        <div class="min-w-0">
          <div class="text-2xl font-semibold tracking-tight tabular-nums">{{ formatCompact(usage.tokens) }} <span class="text-sm font-normal text-muted-foreground">tokens</span></div>
          <p class="text-xs text-muted-foreground">of the {{ formatCompact(usage.contextWindow) }} context window</p>
        </div>
      </div>

      <dl class="divide-y text-sm">
        <div v-for="r in rows" :key="r.label" class="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
          <dt class="text-muted-foreground">{{ r.label }}</dt>
          <dd class="tabular-nums" :class="r.mono ? 'font-mono text-xs' : ''">{{ r.value }}</dd>
        </div>
      </dl>

      <p class="text-[11px] text-muted-foreground">Planner responses are simulated in this version.</p>
    </DialogContent>
  </Dialog>
</template>
