<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { datasetRoute } from '@/router'
import { toast } from '@/components/ui/toast'
import { Database, PauseCircle, PlayCircle, Clock, Trash2 } from '@lucide/vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import RangeSelect from '@/components/common/RangeSelect.vue'
import GoalProgressChart from '@/components/charts/GoalProgressChart.vue'
import RadialRingsChart from '@/components/charts/RadialRingsChart.vue'
import UsageAreaChart from '@/components/charts/UsageAreaChart.vue'
import DeleteMissionDialog from '@/components/missions/DeleteMissionDialog.vue'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { visualFor } from '@/lib/visuals'
import { api } from '@convex/_generated/api'
import { errorMessage, useQuery } from '@/lib/convex'
import { allMissions, missionsLoaded, setMissionStatus } from '@/stores/missions'
import { rangeDays } from '@/lib/ranges'
import { formatCurrencyRound, formatDate, formatNumber, isoToday } from '@/lib/format'

const route = useRoute()
const router = useRouter()
const mission = computed(() => allMissions.value.find((m) => m.id === route.params.id))
const range = ref('90d')
const { data: daily } = useQuery(api.missions.daily, () =>
  mission.value ? { id: mission.value.id, today: isoToday(), days: rangeDays(range.value) } : 'skip',
)
// Charts wait for the first reviewed video; until then the empty state explains why.
const rows = computed(() => (mission.value?.processed ? daily.value ?? [] : []))

// One outcome at a time; colors match StatusBadge (accepted green, rejected red, in QA yellow).
// Accepted shows the running total against the goal; the others show daily counts.
const OUTCOMES = [
  { key: 'accepted', label: 'Accepted', color: 'var(--status-good)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--status-critical)' },
  { key: 'processing', label: 'Pending', color: 'var(--status-warning)' },
]
const outcome = ref('accepted')
const series = computed(() => [OUTCOMES.find((o) => o.key === outcome.value)])
const outcomeTotal = computed(() => rows.value.reduce((s, r) => s + (r[outcome.value] ?? 0), 0))

// Running total of accepted videos, offset by everything accepted before the window.
const cumulative = computed(() => {
  const inRange = rows.value.reduce((s, r) => s + r.accepted, 0)
  let total = mission.value.accepted - inRange
  return rows.value.map((r) => ({ date: r.date, total: (total += r.accepted) }))
})

const stats = computed(() => {
  const m = mission.value
  return [
    { label: 'Accepted videos', value: formatNumber(m.accepted) },
    { label: 'Spent', value: formatCurrencyRound(m.cost) },
    { label: m.end ? 'Completed' : 'Started', value: formatDate(m.end ?? m.start) },
    // Collection runs in the US only for now.
    { label: 'Regions', value: 'US' },
  ]
})

const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : null)

// Per-task share of submissions and acceptance among reviewed videos.
const taskStats = computed(() => {
  const m = mission.value
  if (!m) return []
  return m.tasks.map((t) => ({
    ...t,
    share: percent(t.submitted, m.submitted) ?? 0,
    acceptance: percent(t.accepted, t.accepted + t.rejected),
  }))
})

// Legend lists the first few tasks; the rest stay on the rings (hover for values).
const LEGEND_LIMIT = 3
const legendExpanded = ref(false)
const legendItems = computed(() => (legendExpanded.value ? rings.value : rings.value.slice(0, LEGEND_LIMIT)))

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
const overallAcceptance = computed(() => (mission.value ? percent(mission.value.accepted, mission.value.processed) : null))

const deleteOpen = ref(false)

async function togglePause() {
  const m = mission.value
  const next = m.status === 'paused' ? 'active' : 'paused'
  try {
    await setMissionStatus(m.id, next)
  } catch (e) {
    return toast.add({ title: errorMessage(e), type: 'error' })
  }
  toast.add({ title: next === 'paused' ? `${m.name} paused` : `${m.name} resumed` })
}
</script>

<template>
  <div v-if="mission" class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
    <!-- Extra top padding gives the detail title breathing room below the breadcrumb -->
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-1 sm:pt-3">
      <div class="flex min-w-0 items-center gap-4">
        <span class="flex size-12 shrink-0 items-center justify-center rounded-xl" :class="visualFor(mission.name, mission).tone">
          <component :is="visualFor(mission.name, mission).icon" class="size-6" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <div class="flex items-center gap-2.5">
            <h1 class="truncate text-2xl font-semibold tracking-tight">{{ mission.name }}</h1>
            <StatusBadge :status="mission.status" class="shrink-0" />
          </div>
          <p class="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{{ mission.description }}</p>
        </div>
      </div>
      <div class="flex shrink-0 gap-2">
        <Button variant="outline" @click="router.push(datasetRoute(mission))"><Database class="size-4" /> Videos</Button>
        <Button v-if="mission.status === 'active' || mission.status === 'paused'" variant="outline" @click="togglePause">
          <PlayCircle v-if="mission.status === 'paused'" class="size-4" />
          <PauseCircle v-else class="size-4" />
          {{ mission.status === 'paused' ? 'Resume' : 'Pause' }}
        </Button>
        <Button variant="outline" size="icon" class="text-muted-foreground hover:text-destructive" aria-label="Delete mission" @click="deleteOpen = true">
          <Trash2 class="size-4" />
        </Button>
      </div>
    </header>

    <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
      <div v-for="s in stats" :key="s.label" class="bg-background px-4 py-3">
        <dt class="text-xs text-muted-foreground">{{ s.label }}</dt>
        <dd class="mt-0.5 truncate text-lg font-semibold tracking-tight tabular-nums">{{ s.value }}</dd>
      </div>
    </dl>

    <div class="grid gap-4 *:min-w-0 lg:grid-cols-[1fr_300px]">
    <Card class="shadow-none">
      <CardHeader>
        <CardTitle>{{ outcome === 'accepted' ? 'Progress to goal' : 'Collection over time' }}</CardTitle>
        <CardDescription>
          <template v-if="outcome === 'accepted'">
            <span class="tabular-nums">{{ formatNumber(mission.accepted) }} / {{ formatNumber(mission.target) }}</span> accepted videos · {{ mission.progress }}%
          </template>
          <template v-else>
            <span class="tabular-nums">{{ formatNumber(outcomeTotal) }}</span> {{ outcome === 'rejected' ? 'rejected videos' : 'videos pending review' }} in this period
          </template>
        </CardDescription>
        <CardAction><RangeSelect v-model="range" /></CardAction>
      </CardHeader>
      <CardContent class="flex flex-1 flex-col gap-3 px-2 sm:px-6">
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
        <template v-if="rows.length">
          <GoalProgressChart v-if="outcome === 'accepted'" :data="cumulative" :goal="mission.target" />
          <UsageAreaChart v-else :data="rows" :series="series" :stacked="false" :legend="false" />
        </template>
        <div v-else class="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm text-muted-foreground">
          <span class="font-medium text-foreground">{{ mission.status === 'draft' ? 'Not launched yet' : 'Collection just started' }}</span>
          Charts appear once the first videos clear quality review.
        </div>
      </CardContent>
    </Card>

    <Card class="shadow-none">
      <CardHeader>
        <CardTitle>Acceptance by task</CardTitle>
        <CardDescription>Share of reviewed videos that passed QA</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <RadialRingsChart
          :items="rings"
          :size="200"
          :center-value="overallAcceptance === null ? '—' : overallAcceptance + '%'"
          center-label="overall"
        />
        <ul class="grid gap-2.5 text-sm">
          <li v-for="r in legendItems" :key="r.key" class="flex items-center gap-2.5">
            <span class="size-3 shrink-0 rounded-[3px]" :style="{ background: r.color }" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate">{{ r.label }}</span>
            <span class="tabular-nums text-muted-foreground">{{ r.value === null ? '—' : r.value + '%' }}</span>
          </li>
        </ul>
        <button
          v-if="rings.length > LEGEND_LIMIT"
          type="button"
          class="-mt-1 self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          @click="legendExpanded = !legendExpanded"
        >
          {{ legendExpanded ? 'Show less' : `+${rings.length - LEGEND_LIMIT} more` }}
        </button>
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
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg" :class="visualFor(t.name, t).tone">
            <component :is="visualFor(t.name, t).icon" class="size-5" aria-hidden="true" />
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

    <DeleteMissionDialog v-model:open="deleteOpen" :mission="mission" :redirect="{ name: mission.status === 'completed' ? 'missions-completed' : 'missions-active' }" />
  </div>

  <p v-else-if="!missionsLoaded" class="p-10 text-center text-sm text-muted-foreground" role="status">Loading mission…</p>

  <div v-else class="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
    <p class="text-lg font-medium">Mission not found</p>
    <Button variant="outline" @click="router.push({ name: 'missions-active' })">Back to missions</Button>
  </div>
</template>
