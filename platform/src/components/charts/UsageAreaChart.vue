<script setup>
import { computed } from 'vue'
import { VisArea, VisAxis, VisLine, VisXYContainer } from '@unovis/vue'
import { CurveType } from '@unovis/ts'
import {
  ChartContainer,
  ChartCrosshair,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
} from '@/components/ui/chart'
import ChartSkeleton from './ChartSkeleton.vue'
import { useChartLoading } from './useChartLoading'
import { formatCompact, formatShortDate } from '@/lib/format'

/**
 * Stacked area chart over daily rows ({ date: 'YYYY-MM-DD', ...metrics }).
 * `series`: [{ key, label, color }] — colors should be chart tokens.
 */
const props = defineProps({
  data: { type: Array, required: true },
  series: { type: Array, required: true },
  stacked: { type: Boolean, default: true },
  height: { type: String, default: 'h-[280px]' },
  yFormat: { type: Function, default: (v) => formatCompact(v) },
  legend: { type: Boolean, default: true },
})

const loading = useChartLoading(() => props.data)

const chartConfig = computed(() =>
  Object.fromEntries(props.series.map((s) => [s.key, { label: s.label, color: s.color }])),
)

const rows = computed(() =>
  props.data.map((r) => ({ ...r, ts: new Date(r.date + 'T12:00:00Z').getTime() })),
)

const x = (d) => d.ts
const ys = computed(() => props.series.map((s) => (d) => d[s.key]))
// Cumulative accessors so the stroke sits on top of each stacked band.
const lineYs = computed(() =>
  props.series.map((_, i) => (d) =>
    props.stacked ? props.series.slice(0, i + 1).reduce((sum, s) => sum + (d[s.key] ?? 0), 0) : d[props.series[i].key],
  ),
)
const colors = computed(() => props.series.map((s) => s.color))
const colorAt = (_, i) => colors.value[i]

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
      <template v-if="stacked">
        <VisArea :x="x" :y="ys" :color="colorAt" :opacity="0.18" :curve-type="CurveType.MonotoneX" />
      </template>
      <template v-else>
        <VisArea
          v-for="(y, i) in ys"
          :key="series[i].key"
          :x="x"
          :y="y"
          :color="colors[i]"
          :opacity="0.12"
          :curve-type="CurveType.MonotoneX"
        />
      </template>
      <VisLine :x="x" :y="lineYs" :color="colorAt" :line-width="2" :curve-type="CurveType.MonotoneX" />
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
      <VisAxis
        type="y"
        :num-ticks="4"
        :tick-line="false"
        :domain-line="false"
        :tick-format="yFormat"
      />
      <ChartTooltip />
      <ChartCrosshair :template="tooltipTemplate" :x="x" :y="lineYs" :color="colorAt" />
    </VisXYContainer>
    <ChartLegendContent v-if="legend && series.length > 1" class="justify-start pl-1" />
  </ChartContainer>
</template>
