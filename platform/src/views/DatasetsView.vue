<script setup>
import { ChevronRight } from '@lucide/vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { datasets, missionById } from '@/data/mock'
import { visualFor } from '@/lib/visuals'
import { formatNumber } from '@/lib/format'
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
    <PageHeader title="Datasets" />

    <!-- Dataset bundles: click to open a dataset's videos -->
    <ul class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <li v-for="(d, i) in datasets" :key="d.id" class="rise-in" :style="{ animationDelay: `${Math.min(i, 9) * 35}ms` }">
        <RouterLink
          :to="{ name: 'dataset-detail', params: { id: d.id } }"
          class="group relative flex h-full w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg" :class="visualFor(missionById[d.missionId].name).tone">
            <component :is="visualFor(missionById[d.missionId].name).icon" class="size-5" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ missionById[d.missionId].name }}</span>
            <span class="mt-0.5 block text-xs text-muted-foreground tabular-nums">{{ formatNumber(d.videos) }} videos · {{ formatNumber(d.hours) }} h</span>
          </span>
          <ChevronRight class="size-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
