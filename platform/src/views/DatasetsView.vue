<script setup>
import { ChevronRight, Database } from '@lucide/vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { api } from '@convex/_generated/api'
import { useQuery } from '@/lib/convex'
import { visualFor } from '@/lib/visuals'
import { formatNumber } from '@/lib/format'

const { data: datasets } = useQuery(api.datasets.list)
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
    <PageHeader title="Datasets" />

    <p v-if="!datasets" class="py-16 text-center text-sm text-muted-foreground" role="status">Loading datasets…</p>

    <div v-else-if="!datasets.length" class="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span class="flex size-11 items-center justify-center rounded-xl bg-muted"><Database class="size-5 text-muted-foreground" /></span>
      <div>
        <p class="font-medium">No datasets yet</p>
        <p class="mt-1 text-sm text-muted-foreground">A mission gets a dataset as soon as its first video passes quality review.</p>
      </div>
    </div>

    <!-- Dataset bundles: click to open a dataset's videos -->
    <ul v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <li v-for="(d, i) in datasets" :key="d.id" class="rise-in" :style="{ animationDelay: `${Math.min(i, 9) * 35}ms` }">
        <RouterLink
          :to="{ name: 'dataset-detail', params: { id: d.id } }"
          class="group relative flex h-full w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg" :class="visualFor(d.missionName, { icon: d.missionIcon, tone: d.missionTone }).tone">
            <component :is="visualFor(d.missionName, { icon: d.missionIcon, tone: d.missionTone }).icon" class="size-5" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ d.missionName }}</span>
            <span class="mt-0.5 block text-xs text-muted-foreground tabular-nums">{{ formatNumber(d.videos) }} videos · {{ d.hours }} h</span>
          </span>
          <ChevronRight class="size-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
