<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAui, useAuiState } from '@assistant-ui/vue'
import { Receipt, CircleCheck, PencilLine, Wallet, ShieldCheck, AlertTriangle } from '@lucide/vue'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { planner } from '@/stores/missions'
import { organization } from '@/stores/session'
import { visualFor } from '@/lib/visuals'
import { formatCurrency, formatCurrencyRound, formatNumber } from '@/lib/format'

// Estimate lines carry only names; the planner's tasks hold the icon and tone picked for them.
const lineVisual = (name) => visualFor(name, planner.plan?.tasks.find((t) => t.name === name))

const props = defineProps({
  tool: { type: Object, required: true },
})

const aui = useAui()
const isRunning = useAuiState((s) => s.thread.isRunning)
const est = computed(() => props.tool.part.result)
const current = computed(
  () => planner.estimateCallId === props.tool.part.toolCallId && planner.estimate && !planner.launchedMissionId,
)
const launched = computed(() => planner.estimateCallId === props.tool.part.toolCallId && planner.launchedMissionId)

// Each task's segment uses its icon tile's hue, so the bar reads without a legend.
const PROCESSING_COLOR = 'color-mix(in oklab, var(--muted-foreground) 35%, transparent)'

// One segment per task plus QA processing, each with its share of the total.
const segments = computed(() => {
  const e = est.value
  if (!e) return []
  const pct = (v) => (e.total ? (v / e.total) * 100 : 0)
  return [
    ...e.lines.map((l) => ({ key: l.name, label: l.name, value: l.subtotal, pct: pct(l.subtotal), color: lineVisual(l.name).color, line: l })),
    { key: 'qa', label: 'QA processing', value: e.processing, pct: pct(e.processing), color: PROCESSING_COLOR },
  ]
})

const coverage = computed(() => {
  const total = est.value?.total ?? 0
  const balance = organization.value?.balance ?? 0
  return {
    balance,
    covered: balance >= total,
    usedPct: balance ? Math.min(100, (total / balance) * 100) : 100,
    remaining: balance - total,
  }
})
</script>

<template>
  <Card v-if="est" class="rise-in my-3 gap-0 overflow-hidden py-0 shadow-none">
    <!-- Hero: total and its composition -->
    <div class="flex flex-col gap-4 p-4 sm:p-5">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-2 text-sm font-medium">
          <span class="flex size-7 items-center justify-center rounded-md border bg-muted/40"><Receipt class="size-3.5" /></span>
          Cost estimate
        </div>
        <span class="text-xs text-muted-foreground tabular-nums">avg {{ formatCurrency(est.avgPrice) }} / video</span>
      </div>

      <div>
        <div class="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{{ formatCurrency(est.total) }}</div>
        <p class="mt-1 text-xs text-muted-foreground">Estimated total · you only pay for accepted videos plus QA</p>
      </div>

      <div class="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" :aria-label="segments.map((s) => `${s.label} ${Math.round(s.pct)}%`).join(', ')">
        <div
          v-for="s in segments"
          :key="s.key"
          class="h-full transition-[flex-grow] duration-500 first:rounded-l-full last:rounded-r-full"
          :style="{ flexGrow: Math.max(s.pct, 0.5), flexBasis: 0, background: s.color }"
          :title="`${s.label} · ${formatCurrency(s.value)}`"
        />
      </div>

      <ul class="grid gap-1">
        <li v-for="s in segments" :key="s.key" class="flex items-center gap-3 rounded-lg px-1 py-1.5 text-sm">
          <span v-if="s.line" class="flex size-7 shrink-0 items-center justify-center rounded-md" :class="lineVisual(s.label).tone">
            <component :is="lineVisual(s.label).icon" class="size-3.5" aria-hidden="true" />
          </span>
          <span v-else class="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <ShieldCheck class="size-3.5" aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium">{{ s.label }}</div>
            <div class="truncate text-xs text-muted-foreground tabular-nums">
              <template v-if="s.line">{{ formatNumber(s.line.videos) }} videos × {{ formatCurrency(s.line.price) }}</template>
              <template v-else>{{ formatNumber(est.expectedSubmissions) }} submissions · {{ Math.round(est.acceptRate * 100) }}% expected acceptance</template>
            </div>
          </div>
          <span class="hidden w-10 text-right text-xs text-muted-foreground tabular-nums sm:block">{{ Math.round(s.pct) }}%</span>
          <span class="w-24 text-right font-medium tabular-nums">{{ formatCurrency(s.value) }}</span>
        </li>
      </ul>
    </div>

    <CardContent class="px-0">
      <!-- Credit coverage -->
      <div class="grid gap-2 border-t px-4 py-3 sm:px-5">
        <div class="flex items-center justify-between gap-3 text-xs">
          <span class="flex items-center gap-1.5 text-muted-foreground"><Wallet class="size-3.5" /> Credit balance {{ formatCurrencyRound(coverage.balance) }}</span>
          <span v-if="coverage.covered" class="flex items-center gap-1 font-medium text-status-good-text">
            <ShieldCheck class="size-3.5" /> Covered · {{ formatCurrencyRound(coverage.remaining) }} left after
          </span>
          <span v-else class="flex items-center gap-1 font-medium">
            <AlertTriangle class="size-3.5 text-status-warning" /> {{ formatCurrencyRound(-coverage.remaining) }} short ·
            <RouterLink :to="{ name: 'billing' }" class="underline underline-offset-4">Add credits</RouterLink>
          </span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-muted" role="img" :aria-label="`Mission uses ${Math.round(coverage.usedPct)}% of credit balance`">
          <div
            class="h-full rounded-full transition-[width] duration-500"
            :class="coverage.covered ? 'bg-status-good' : 'bg-status-warning'"
            :style="{ width: coverage.usedPct + '%' }"
          />
        </div>
      </div>
    </CardContent>

    <CardFooter class="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3 !pt-3 sm:px-5">
      <span class="text-xs text-muted-foreground">Billed from prepaid credits as videos are accepted</span>
      <div v-if="current" class="flex gap-2">
        <Button variant="outline" size="sm" :disabled="isRunning" @click="aui.thread.append('I\'d like to adjust the tasks first.')">
          <PencilLine class="size-4" /> Adjust
        </Button>
        <Button size="sm" :disabled="isRunning" @click="aui.thread.append('Approve and launch the mission.')">
          <CircleCheck class="size-4" /> Approve
        </Button>
      </div>
      <Badge v-else-if="launched" variant="secondary">Approved</Badge>
      <Badge v-else variant="outline" class="text-muted-foreground">Superseded</Badge>
    </CardFooter>
  </Card>
</template>
