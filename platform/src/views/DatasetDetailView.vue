<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Download, Search, X, ChevronLeft, ChevronRight, Target, Globe2, ListChecks } from '@lucide/vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import VideoDetailSheet from '@/components/datasets/VideoDetailSheet.vue'
import ExportDialog from '@/components/datasets/ExportDialog.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { datasetById, missionById, videos } from '@/data/mock'
import { visualFor } from '@/lib/visuals'
import { formatDate, formatDuration, formatNumber } from '@/lib/format'

const route = useRoute()
const router = useRouter()

const PAGE_SIZE = 15
const search = ref('')
const status = ref('all')
const page = ref(1)
const selected = ref(null)
const detailOpen = ref(false)
const exportOpen = ref(false)

const dataset = computed(() => datasetById[route.params.id] ?? null)
const mission = computed(() => (dataset.value ? missionById[dataset.value.missionId] : null))
const visual = computed(() => visualFor(mission.value?.name ?? ''))
const version = computed(() => dataset.value?.name.split(' · ').at(-1) ?? '')

// Simulated fetch so the skeleton state is visible; repeats when switching datasets.
const loading = ref(true)
let timer
function load() {
  loading.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (loading.value = false), 450)
}
load()
onBeforeUnmount(() => clearTimeout(timer))
watch(() => route.params.id, () => {
  search.value = ''
  status.value = 'all'
  load()
})
watch([search, status], () => (page.value = 1))

const datasetVideos = computed(() => videos.filter((v) => v.missionId === dataset.value?.missionId))
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return datasetVideos.value.filter(
    (v) =>
      (status.value === 'all' || v.status === status.value) &&
      (!q || v.id.toLowerCase().includes(q) || v.task.toLowerCase().includes(q) || v.collector.toLowerCase().includes(q)),
  )
})

const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const pageRows = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
const hasFilters = computed(() => search.value || status.value !== 'all')

const stats = computed(() => {
  const accepted = datasetVideos.value.filter((v) => v.status === 'accepted')
  const avgQuality = accepted.length ? Math.round(accepted.reduce((s, v) => s + v.quality, 0) / accepted.length) : null
  return [
    { label: 'Accepted videos', value: formatNumber(dataset.value?.videos) },
    { label: 'Footage', value: `${formatNumber(dataset.value?.hours)} h` },
    { label: 'Avg. quality', value: avgQuality ?? '—' },
    { label: 'Updated', value: dataset.value ? formatDate(dataset.value.updatedAt) : '—' },
  ]
})

function clearFilters() {
  search.value = ''
  status.value = 'all'
}

function openVideo(v) {
  selected.value = v
  detailOpen.value = true
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
    <div v-if="!dataset" class="flex flex-col items-center gap-3 py-24 text-center">
      <p class="text-sm text-muted-foreground">This dataset doesn't exist or has no accepted videos yet.</p>
      <Button variant="outline" @click="router.push({ name: 'datasets' })"><ArrowLeft class="size-4" /> All datasets</Button>
    </div>

    <template v-else>
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex min-w-0 items-start gap-3">
          <Button variant="ghost" size="icon" class="-ml-2 mt-1.5 size-8 shrink-0 text-muted-foreground" aria-label="Back to datasets" @click="router.push({ name: 'datasets' })">
            <ArrowLeft class="size-4" />
          </Button>
          <span class="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl" :class="visual.tone">
            <component :is="visual.icon" class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <h1 class="truncate text-2xl font-semibold tracking-tight">{{ mission.name }}</h1>
            <p class="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{{ mission.description }}</p>
            <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span class="font-mono">{{ dataset.id }}</span>
              <span class="rounded border px-1 font-mono text-[11px]">{{ version }}</span>
              <span class="flex items-center gap-1"><ListChecks class="size-3" /> {{ mission.tasks.length }} tasks</span>
              <span class="flex items-center gap-1"><Globe2 class="size-3" /> {{ mission.regions.join(', ') }}</span>
              <StatusBadge :status="mission.status" class="h-5 text-[11px]" />
            </div>
          </div>
        </div>
        <div class="flex shrink-0 gap-2">
          <Button variant="outline" @click="router.push({ name: 'mission-detail', params: { id: mission.id } })"><Target class="size-4" /> Mission</Button>
          <Button @click="exportOpen = true"><Download class="size-4" /> Export</Button>
        </div>
      </div>

      <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
        <div v-for="s in stats" :key="s.label" class="bg-background px-4 py-3">
          <dt class="text-xs text-muted-foreground">{{ s.label }}</dt>
          <dd class="mt-0.5 text-lg font-semibold tracking-tight tabular-nums">{{ s.value }}</dd>
        </div>
      </dl>

      <!-- Filters -->
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div class="relative sm:w-72">
          <Search class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="search" placeholder="Search videos…" class="pl-8" aria-label="Search videos" />
        </div>
        <Select v-model="status">
          <SelectTrigger class="w-full sm:w-40" aria-label="Quality status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
          </SelectContent>
        </Select>
        <Button v-if="hasFilters" variant="ghost" size="sm" class="text-muted-foreground sm:ml-auto" @click="clearFilters">
          <X class="size-4" /> Clear
        </Button>
      </div>

      <Card class="gap-0 py-0 shadow-none">
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="pl-4">Video ID</TableHead>
                <TableHead>Task</TableHead>
                <TableHead class="hidden md:table-cell">Collector</TableHead>
                <TableHead class="text-right">Duration</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead class="hidden pr-4 text-right sm:table-cell">Collected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-if="loading">
                <TableRow v-for="i in 8" :key="i">
                  <TableCell class="pl-4"><Skeleton class="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton class="h-4 w-32" /></TableCell>
                  <TableCell class="hidden md:table-cell"><Skeleton class="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton class="ml-auto h-4 w-10" /></TableCell>
                  <TableCell><Skeleton class="h-5 w-24 rounded-full" /></TableCell>
                  <TableCell class="hidden pr-4 sm:table-cell"><Skeleton class="ml-auto h-4 w-20" /></TableCell>
                </TableRow>
              </template>
              <template v-else>
                <TableRow
                  v-for="v in pageRows"
                  :key="v.id"
                  class="cursor-pointer"
                  tabindex="0"
                  @click="openVideo(v)"
                  @keydown.enter="openVideo(v)"
                >
                  <TableCell class="pl-4 font-mono text-xs">{{ v.id }}</TableCell>
                  <TableCell class="font-medium">{{ v.task }}</TableCell>
                  <TableCell class="hidden font-mono text-xs text-muted-foreground md:table-cell">{{ v.collector }}</TableCell>
                  <TableCell class="text-right font-mono text-xs tabular-nums">{{ formatDuration(v.duration) }}</TableCell>
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <StatusBadge :status="v.status" />
                      <span v-if="v.quality" class="text-xs tabular-nums text-muted-foreground">{{ v.quality }}</span>
                    </div>
                  </TableCell>
                  <TableCell class="hidden pr-4 text-right text-muted-foreground sm:table-cell">{{ formatDate(v.createdAt) }}</TableCell>
                </TableRow>
                <TableRow v-if="!pageRows.length">
                  <TableCell colspan="6" class="h-32 text-center text-muted-foreground">
                    {{ hasFilters ? 'No videos match these filters.' : 'No recent submissions for this dataset.' }}
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </CardContent>
        <div class="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
          <span>
            <template v-if="filtered.length">{{ (page - 1) * PAGE_SIZE + 1 }}–{{ Math.min(page * PAGE_SIZE, filtered.length) }} of {{ formatNumber(filtered.length) }} recent videos</template>
            <template v-else>0 videos</template>
          </span>
          <div class="flex items-center gap-1">
            <Button variant="outline" size="icon" class="size-8" :disabled="page <= 1" aria-label="Previous page" @click="page--"><ChevronLeft class="size-4" /></Button>
            <span class="px-2 tabular-nums">Page {{ page }} / {{ pageCount }}</span>
            <Button variant="outline" size="icon" class="size-8" :disabled="page >= pageCount" aria-label="Next page" @click="page++"><ChevronRight class="size-4" /></Button>
          </div>
        </div>
      </Card>

      <VideoDetailSheet v-model:open="detailOpen" :video="selected" />
      <ExportDialog
        v-model:open="exportOpen"
        :filtered-count="filtered.filter((v) => v.status === 'accepted').length"
        :mission-id="dataset.missionId"
      />
    </template>
  </div>
</template>
