<script setup>
import { computed } from 'vue'
import { VisAxis, VisStackedBar, VisXYContainer } from '@unovis/vue'
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
} from '@/components/ui/chart'
import ChartSkeleton from './ChartSkeleton.vue'
import { useChartLoading } from './useChartLoading'
import { formatCompact } from '@/lib/format'

// Monthly spend bars ({ month: 'YYYY-MM', cost }).
const props = defineProps({
  data: { type: Array, required: true },
})

const loading = useChartLoading(() => props.data)

const chartConfig = { cost: { label: 'Spend ($)', color: 'var(--chart-1)' } }
const rows = computed(() => props.data.map((d, i) => ({ ...d, i, cost: Math.round(d.cost) })))
const label = (m) => new Date(m + '-15T00:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
const x = (d) => d.i
const y = (d) => d.cost
const template = componentToString(chartConfig, ChartTooltipContent, {
  labelFormatter: (i) => {
    const m = rows.value[Math.round(i)]?.month
    return m ? new Date(m + '-15T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''
  },
})
</script>

<template>
  <ChartSkeleton v-if="loading" height="h-[240px]" />
  <ChartContainer v-else :config="chartConfig" class="aspect-auto h-[240px] w-full animate-in fade-in-0 duration-300">
    <VisXYContainer :data="rows" :duration="0" :margin="{ left: 4, right: 4, top: 8 }" :y-domain-min-constraint="[0, 0]">
      <VisStackedBar :x="x" :y="y" color="var(--chart-1)" :rounded-corners="4" :bar-padding="0.35" />
      <VisAxis
        type="x"
        :x="x"
        :tick-line="false"
        :domain-line="false"
        :grid-line="false"
        :num-ticks="rows.length"
        :tick-format="(i) => (rows[i] ? label(rows[i].month) : '')"
      />
      <VisAxis type="y" :num-ticks="4" :tick-line="false" :domain-line="false" :tick-format="(v) => '$' + formatCompact(v)" />
      <ChartTooltip />
      <ChartCrosshair :template="template" :x="x" :y="y" color="var(--chart-1)" />
    </VisXYContainer>
  </ChartContainer>
</template>
