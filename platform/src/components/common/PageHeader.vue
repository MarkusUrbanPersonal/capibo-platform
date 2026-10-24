<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
})
</script>

<template>
  <!-- min-h matches the action buttons, so titles sit at the same height with or without actions -->
  <div class="flex flex-col gap-3 sm:min-h-9 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0">
      <h1 class="text-2xl font-semibold tracking-tight">{{ title }}</h1>
      <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
