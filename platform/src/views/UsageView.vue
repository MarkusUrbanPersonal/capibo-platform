<script setup>
import { computed, ref } from 'vue'
import { Timer, Gauge, ShieldCheck, Layers } from '@lucide/vue'
import PageHeader from '@/components/common/PageHeader.vue'
import RangeSelect from '@/components/common/RangeSelect.vue'
import UsageAreaChart from '@/components/charts/UsageAreaChart.vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { missionTotals, RANGE_OPTIONS, rangeDays, sumRows, usageForRange, videos } from '@/data/mock'
import { formatCurrency, formatCurrencyRound, formatNumber } from '@/lib/format'

// One date range for the whole page.
const range = ref('30d')

const days = computed(() => rangeDays(range.value))
const rows = computed(() => usageForRange(days.value))
const totals = computed(() => sumRows(rows.value))
const costSeries = [{ key: 'cost', label: 'Credits used ($)', color: 'var(--chart-1)' }]

const byMission = computed(() => {
  const list = missionTotals(days.value).filter((m) => m.submitted > 0).sort((a, b) => b.submitted - a.submitted)
  const max = Math.max(...list.map((m) => m.submitted), 1)
  return list.map((m) => ({ ...m, bar: (m.submitted / max) * 100 }))
})

const qualityStats = computed(() => {
  const t = totals.value
  const accepted = videos.filter((v) => v.status === 'accepted')
  const avgScore = accepted.length ? Math.round(accepted.reduce((s, v) => s + v.quality, 0) / accepted.length) : 0
  return [
    { label: 'Acceptance rate', value: t.processed ? `${((t.accepted / t.processed) * 100).toFixed(1)}%` : '—', icon: ShieldCheck, detail: 'accepted ÷ reviewed' },
    { label: 'Avg. quality score', value: String(avgScore), icon: Gauge, detail: 'accepted videos, 0–100' },
    { label: 'Median time to review', value: '18 min', icon: Timer, detail: 'p95 2.4 h' },
    { label: 'QA throughput', value: `${formatNumber(t.processed / days.value / 24)}/h`, icon: Layers, detail: 'videos reviewed per hour' },
  ]
})

const costTotals = computed(() => {
  const t = totals.value
  return { total: t.cost, perAccepted: t.accepted ? t.cost / t.accepted : 0, daily: t.cost / days.value }
})
const rangeLabel = computed(() => RANGE_OPTIONS.find((o) => o.value === range.value)?.label.toLowerCase() ?? '')

</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
    <PageHeader title="Usage">
      <template #actions>
        <RangeSelect v-model="range" />
      </template>
    </PageHeader>

    <Card class="shadow-none">
      <CardHeader>
        <CardTitle>Credit consumption</CardTitle>
        <CardDescription>
          <span class="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{{ formatCurrency(costTotals.total) }}</span>
          <span class="ml-2">{{ formatCurrency(costTotals.perAccepted) }} per accepted video · {{ formatCurrency(costTotals.daily) }}/day</span>
        </CardDescription>
      </CardHeader>
      <CardContent class="px-2 sm:px-6">
        <UsageAreaChart :data="rows" :series="costSeries" :stacked="false" height="h-[260px]" :y-format="(v) => '$' + formatNumber(v)" />
      </CardContent>
    </Card>

    <div class="grid gap-4 *:min-w-0 lg:grid-cols-5">
      <Card class="shadow-none lg:col-span-3">
        <CardHeader>
          <CardTitle>Usage by mission</CardTitle>
          <CardDescription>Submissions, acceptance and spend · {{ rangeLabel }}</CardDescription>
        </CardHeader>
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="pl-6">Mission</TableHead>
                <TableHead class="w-[30%]">Submitted</TableHead>
                <TableHead class="hidden text-right sm:table-cell">Acceptance</TableHead>
                <TableHead class="pr-6 text-right">Spend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="m in byMission" :key="m.id">
                <TableCell class="pl-6 font-medium">{{ m.name }}</TableCell>
                <TableCell>
                  <div class="flex items-center gap-2">
                    <div class="h-2 flex-1 rounded-full bg-muted">
                      <div class="h-2 rounded-full bg-chart-1" :style="{ width: m.bar + '%' }" />
                    </div>
                    <span class="w-12 text-right text-xs tabular-nums">{{ formatNumber(m.submitted) }}</span>
                  </div>
                </TableCell>
                <TableCell class="hidden text-right tabular-nums sm:table-cell">{{ m.processed ? ((m.accepted / m.processed) * 100).toFixed(1) + '%' : '—' }}</TableCell>
                <TableCell class="pr-6 text-right tabular-nums">{{ formatCurrencyRound(m.cost) }}</TableCell>
              </TableRow>
              <TableRow v-if="!byMission.length">
                <TableCell colspan="4" class="h-24 text-center text-muted-foreground">No activity in this period.</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card class="shadow-none lg:col-span-2">
        <CardHeader>
          <CardTitle>Quality &amp; processing</CardTitle>
          <CardDescription>QA pipeline · {{ rangeLabel }}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul class="divide-y">
            <li v-for="q in qualityStats" :key="q.label" class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span class="flex size-9 items-center justify-center rounded-lg border bg-muted/40">
                <component :is="q.icon" class="size-4 text-muted-foreground" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="text-sm">{{ q.label }}</div>
                <div class="text-xs text-muted-foreground">{{ q.detail }}</div>
              </div>
              <span class="text-lg font-semibold tabular-nums">{{ q.value }}</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>

  </div>
</template>
