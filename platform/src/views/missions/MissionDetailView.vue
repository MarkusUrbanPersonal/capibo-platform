<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { datasetRoute } from '@/router'
import { toast } from '@/components/ui/toast'
import { ArrowLeft, Database, PauseCircle, PlayCircle, Globe2, Clock } from '@lucide/vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import RangeSelect from '@/components/common/RangeSelect.vue'
import UsageAreaChart from '@/components/charts/UsageAreaChart.vue'
import RadialRingsChart from '@/components/charts/RadialRingsChart.vue'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { visualFor } from '@/lib/visuals'
import { Progress } from '@/components/ui/progress'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { allMissions, setMissionStatus } from '@/stores/missions'
import { missionDaily, rangeDays, usageForRange, videos } from '@/data/mock'
import { formatCurrencyRound, formatDate, formatNumber } from '@/lib/format'

const route = useRoute()
const router = useRouter()
const mission = computed(() => allMissions.value.find((m) => m.id === route.params.id))
const range = ref('90d')
const hasHistory = computed(() => mission.value && missionDaily[mission.value.id])
const rows = computed(() => (hasHistory.value ? usageForRange(rangeDays(range.value), mission.value.id) : []))

// One outcome at a time; colors match StatusBadge (accepted green, rejected red, in QA yellow).
const OUTCOMES = [
  { key: 'accepted', label: 'Accepted', color: 'var(--status-good)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--status-critical)' },
  { key: 'processing', label: 'Pending', color: 'var(--status-warning)' },
]
const outcome = ref('accepted')
const series = computed(() => [OUTCOMES.find((o) => o.key === outcome.value)])
const outcomeTotal = computed(() => rows.value.reduce((s, r) => s + (r[outcome.value] ?? 0), 0))

// Per-task share of this mission's recent videos (from the video library sample).
const taskStats = computed(() => {
  const m = mission.value
  if (!m) return []
  const sample = videos.filter((v) => v.missionId === m.id)
  return m.tasks.map((t) => {
    const vids = sample.filter((v) => v.task === t.name)
    const reviewed = vids.filter((v) => v.status !== 'processing')
    const accepted = reviewed.filter((v) => v.status === 'accepted').length
    return {
      ...t,
      share: sample.length ? Math.round((vids.length / sample.length) * 100) : 0,
      acceptance: reviewed.length ? Math.round((accepted / reviewed.length) * 100) : null,
      avgDuration: vids.length ? Math.round(vids.reduce((s, v) => s + v.duration, 0) / vids.length) : null,
    }
  })
})

// One ring per task (acceptance rate), shades of one hue from strongest to lightest.
const RING_SHADES = [100, 84, 70, 58, 48, 40]
const rings = computed(() =>
  taskStats.value.map((t, i) => ({
    key: t.id,
    label: t.name,
    value: t.acceptance,
    color: `color-mix(in oklab, var(--status-good) ${RING_SHADES[i % RING_SHADES.length]}%, var(--background))`,
  })),
)
const overallAcceptance = computed(() => {
  const reviewed = videos.filter((v) => v.missionId === mission.value?.id && v.status !== 'processing')
  return reviewed.length ? Math.round((reviewed.filter((v) => v.status === 'accepted').length / reviewed.length) * 100) : null
})

function togglePause() {
  const m = mission.value
  const next = m.status === 'paused' ? 'active' : 'paused'
  setMissionStatus(m.id, next)
  toast.add({ title: next === 'paused' ? `${m.name} paused` : `${m.name} resumed` })
}
</script>

<template>
  <div v-if="mission" class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
    <div>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="icon" class="-ml-2 size-8 shrink-0 text-muted-foreground" aria-label="Back to missions" @click="router.push({ name: mission.status === 'completed' ? 'missions-completed' : 'missions-active' })">
              <ArrowLeft class="size-4" />
            </Button>
            <span class="flex size-11 shrink-0 items-center justify-center rounded-xl" :class="visualFor(mission.name).tone">
              <component :is="visualFor(mission.name).icon" class="size-5" aria-hidden="true" />
            </span>
            <h1 class="text-2xl font-semibold tracking-tight">{{ mission.name }}</h1>
            <StatusBadge :status="mission.status" />
          </div>
          <p class="mt-1 max-w-2xl text-sm text-muted-foreground">{{ mission.description }}</p>
          <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span class="font-mono">{{ mission.id }}</span>
            <span>Started {{ formatDate(mission.start) }}</span>
            <span v-if="mission.end">Completed {{ formatDate(mission.end) }}</span>
            <span class="flex items-center gap-1"><Globe2 class="size-3" /> {{ mission.regions.join(', ') }}</span>
          </div>
        </div>
        <div class="flex shrink-0 gap-2">
          <Button variant="outline" @click="router.push(datasetRoute(mission.id))"><Database class="size-4" /> Videos</Button>
          <Button v-if="mission.status === 'active' || mission.status === 'paused'" variant="outline" @click="togglePause">
            <PlayCircle v-if="mission.status === 'paused'" class="size-4" />
            <PauseCircle v-else class="size-4" />
            {{ mission.status === 'paused' ? 'Resume' : 'Pause' }}
          </Button>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-baseline justify-between gap-3 text-sm">
        <span><span class="text-2xl font-semibold tracking-tight tabular-nums">{{ formatNumber(mission.accepted) }}</span> <span class="text-muted-foreground">/ {{ formatNumber(mission.target) }} accepted videos</span></span>
        <span class="tabular-nums text-muted-foreground">{{ mission.progress }}% · {{ formatCurrencyRound(mission.cost) }} spent</span>
      </div>
      <Progress :model-value="mission.progress" class="h-2 bg-muted *:data-[slot=progress-indicator]:bg-foreground/70" aria-label="Progress to target" />
    </div>

    <div class="grid gap-4 *:min-w-0 lg:grid-cols-[1fr_300px]">
    <Card class="shadow-none">
      <CardHeader>
        <CardTitle>Collection over time</CardTitle>
        <CardDescription>
          <span class="tabular-nums">{{ formatNumber(outcomeTotal) }}</span> {{ series[0].label.toLowerCase() }} videos in this period
        </CardDescription>
        <CardAction><RangeSelect v-model="range" /></CardAction>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 px-2 sm:px-6">
        <ToggleGroup
          v-if="rows.length"
          :model-value="outcome"
          type="single"
          variant="outline"
          size="sm"
          class="self-start"
          aria-label="Quality outcome"
          @update:model-value="(v) => v && (outcome = v)"
        >
          <ToggleGroupItem v-for="o in OUTCOMES" :key="o.key" :value="o.key" class="gap-1.5 px-3">
            <span class="size-2 rounded-full" :style="{ background: o.color }" aria-hidden="true" />
            {{ o.label }}
          </ToggleGroupItem>
        </ToggleGroup>
        <UsageAreaChart v-if="rows.length" :data="rows" :series="series" :stacked="false" :legend="false" />
        <div v-else class="flex h-[200px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm text-muted-foreground">
          <span class="font-medium text-foreground">Collection just started</span>
          Charts appear once the first videos clear quality review.
        </div>
      </CardContent>
    </Card>

    <Card class="shadow-none">
      <CardHeader>
        <CardTitle>Acceptance by task</CardTitle>
        <CardDescription>Share of reviewed videos that passed QA</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-5">
        <RadialRingsChart
          :items="rings"
          :size="200"
          :center-value="overallAcceptance === null ? '—' : overallAcceptance + '%'"
          center-label="overall"
        />
        <ul class="grid gap-2.5 text-sm">
          <li v-for="r in rings" :key="r.key" class="flex items-center gap-2.5">
            <span class="size-3 shrink-0 rounded-[3px]" :style="{ background: r.color }" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate">{{ r.label }}</span>
            <span class="tabular-nums text-muted-foreground">{{ r.value === null ? '—' : r.value + '%' }}</span>
          </li>
        </ul>
      </CardContent>
    </Card>
    </div>

    <section>
      <h2 class="mb-3 text-sm font-medium">Tasks</h2>
      <ul class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <li
          v-for="(t, i) in taskStats"
          :key="t.id"
          class="rise-in flex items-start gap-3 rounded-xl border bg-card p-4"
          :style="{ animationDelay: `${i * 40}ms` }"
        >
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg" :class="visualFor(t.name).tone">
            <component :is="visualFor(t.name).icon" class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium">{{ t.name }}</div>
            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
              <span>{{ t.share }}% of videos</span>
              <span>{{ t.acceptance === null ? '—' : t.acceptance + '%' }} accepted</span>
              <span v-if="t.avgDuration" class="flex items-center gap-1"><Clock class="size-3" />{{ t.avgDuration }}s</span>
            </div>
          </div>
        </li>
      </ul>
    </section>
  </div>

  <div v-else class="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
    <p class="text-lg font-medium">Mission not found</p>
    <Button variant="outline" @click="router.push({ name: 'missions-active' })">Back to missions</Button>
  </div>
</template>
