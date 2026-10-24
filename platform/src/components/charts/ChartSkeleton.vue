<script setup>
import { Skeleton } from '@/components/ui/skeleton'

// Placeholder shown while a chart's data loads: y-axis stubs, a plot block and x-axis stubs.
defineProps({
  height: { type: String, default: 'h-[280px]' },
})
</script>

<template>
  <div :class="['flex w-full flex-col gap-2', height]" role="status" aria-label="Loading chart">
    <div class="flex min-h-0 flex-1 gap-3">
      <div class="flex flex-col justify-between py-1">
        <Skeleton v-for="i in 4" :key="i" class="h-2.5 w-7" />
      </div>
      <Skeleton class="h-full flex-1 rounded-lg" />
    </div>
    <div class="flex justify-between pl-10">
      <Skeleton v-for="i in 6" :key="i" class="h-2.5 w-10" />
    </div>
  </div>
</template>
