<script setup>
import { computed } from 'vue'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Progress } from '@/components/ui/progress'
import { formatCompact, formatNumber } from '@/lib/format'

// Context-window / token usage indicator for the assistant composer. Counts real model calls only.
const props = defineProps({
  usage: { type: Object, required: true },
})

const R = 7
const C = 2 * Math.PI * R
const dash = computed(() => `${(Math.max(props.usage.percent, props.usage.tokens ? 1.5 : 0) / 100) * C} ${C}`)
</script>

<template>
  <HoverCard :open-delay="150">
    <HoverCardTrigger as-child>
      <button
        type="button"
        class="flex h-7 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :aria-label="`Context usage: ${formatNumber(usage.tokens)} of ${formatNumber(usage.contextWindow)} tokens`"
      >
        <svg viewBox="0 0 18 18" class="size-4 -rotate-90" aria-hidden="true">
          <circle cx="9" cy="9" :r="R" fill="none" stroke="currentColor" stroke-opacity="0.2" stroke-width="2.5" />
          <circle cx="9" cy="9" :r="R" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" :stroke-dasharray="dash" />
        </svg>
        <span class="tabular-nums">{{ formatCompact(usage.tokens) }} tokens</span>
        <span class="hidden tabular-nums text-muted-foreground/70 sm:inline">· ${{ usage.cost.toFixed(3) }}</span>
      </button>
    </HoverCardTrigger>
    <HoverCardContent side="top" align="end" class="w-64 text-sm">
      <div class="flex items-center justify-between">
        <span class="font-medium">Context window</span>
        <span class="font-mono text-xs text-muted-foreground">{{ usage.model }}</span>
      </div>
      <Progress :model-value="usage.percent" class="mt-3 h-1.5" aria-hidden="true" />
      <dl class="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
        <dt class="text-muted-foreground">Input tokens</dt>
        <dd class="text-right tabular-nums">{{ formatNumber(usage.inputTokens) }}</dd>
        <dt class="text-muted-foreground">Output tokens</dt>
        <dd class="text-right tabular-nums">{{ formatNumber(usage.outputTokens) }}</dd>
        <dt class="text-muted-foreground">Window</dt>
        <dd class="text-right tabular-nums">{{ formatNumber(usage.contextWindow) }}</dd>
        <dt class="text-muted-foreground">Session cost</dt>
        <dd class="text-right tabular-nums">${{ usage.cost.toFixed(4) }}</dd>
      </dl>
      <p class="mt-3 border-t pt-2 text-[11px] text-muted-foreground">Type <code class="font-mono">/usage</code> for a full report.</p>
    </HoverCardContent>
  </HoverCard>
</template>
