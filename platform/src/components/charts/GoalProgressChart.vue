<script setup>
import { computed } from 'vue'
import { VisArea, VisAxis, VisLine, VisXYContainer } from '@unovis/vue'
import { CurveType } from '@unovis/ts'
import { ChartContainer, ChartCrosshair, ChartTooltip, ChartTooltipContent, componentToString } from '@/components/ui/chart'
import ChartSkeleton from './ChartSkeleton.vue'
import { useChartLoading } from './useChartLoading'
import { formatCompact, formatShortDate } from '@/lib/format'

/**
 * Cumulative total over daily rows ({ date, total }) with the goal as a dashed line.
 */
const props = defineProps({
  data: { type: Array, required: true },
  goal: { type: Number, required: true },
  label: { type: String, default: 'Accepted' },
  color: { type: String, default: 'var(--status-good)' },
  height: { type: String, default: 'h-[280px]' },
})

const loading = useChartLoading(() => props.data)

const chartConfig = computed(() => ({
  total: { label: props.label, color: props.color },
  goal: { label: 'Goal', color: 'var(--muted-foreground)' },
}))

const rows = computed(() =>
  props.data.map((r) => ({ ...r, goal: props.goal, ts: new Date(r.date + 'T12:00:00Z').getTime() })),
)

const x = (d) => d.ts
const total = (d) => d.total
const goal = (d) => d.goal
const lineYs = [total, goal]
const lineColors = computed(() => [props.color, 'var(--muted-foreground)'])
const colorAt = (_, i) => lineColors.value[i]
const dashAt = (_, i) => (i === 1 ? [5, 5] : null)

const numTicks = computed(() => Math.min(7, rows.value.length))
const xTickFormat = (t) => formatShortDate(new Date(t).toISOString().slice(0, 10))

const tooltipTemplate = computed(() =>
  componentToString(chartConfig.value, ChartTooltipContent, {
    labelFormatter: (t) =>
      new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }),
  }),
)
</script>

<template>
  <ChartSkeleton v-if="loading" :height="height" />
  <ChartContainer v-else :config="chartConfig" :class="['aspect-auto w-full animate-in fade-in-0 duration-300', height]" cursor>
    <VisXYContainer :data="rows" :duration="0" :margin="{ left: 4, right: 8, top: 8 }" :y-domain-min-constraint="[0, 0]">
      <VisArea :x="x" :y="total" :color="color" :opacity="0.12" :curve-type="CurveType.MonotoneX" />
      <VisLine :x="x" :y="lineYs" :color="colorAt" :line-width="2" :line-dash-array="dashAt" :curve-type="CurveType.MonotoneX" />
      <VisAxis
        type="x"
        :x="x"
        :tick-line="false"
        :domain-line="false"
        :grid-line="false"
        :num-ticks="numTicks"
        :tick-format="xTickFormat"
        :tick-text-hide-overlapping="true"
      />
      <VisAxis type="y" :num-ticks="4" :tick-line="false" :domain-line="false" :tick-format="(v) => formatCompact(v)" />
      <ChartTooltip />
      <ChartCrosshair :template="tooltipTemplate" :x="x" :y="lineYs" :color="colorAt" />
    </VisXYContainer>
  </ChartContainer>
</template>
