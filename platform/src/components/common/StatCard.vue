<script setup>
import { TrendingUp, TrendingDown } from '@lucide/vue'
import { Card, CardContent } from '@/components/ui/card'

defineProps({
  label: { type: String, required: true },
  value: { type: String, required: true },
  delta: { type: Object, default: null }, // { label, positive }
  hint: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
  // For metrics where "up" is bad (e.g. rejections, spend), invert the delta color.
  invert: { type: Boolean, default: false },
})
</script>

<template>
  <Card class="gap-0 py-0 shadow-none">
    <CardContent class="p-4">
      <div class="flex items-center justify-between text-sm text-muted-foreground">
        <span>{{ label }}</span>
        <component :is="icon" v-if="icon" class="size-4" aria-hidden="true" />
      </div>
      <div class="mt-2 text-2xl font-semibold tracking-tight">{{ value }}</div>
      <div class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          v-if="delta"
          class="inline-flex items-center gap-0.5 font-medium"
          :class="delta.positive !== invert ? 'text-status-good-text' : 'text-status-critical'"
        >
          <component :is="delta.positive ? TrendingUp : TrendingDown" class="size-3" aria-hidden="true" />
          {{ delta.label }}
        </span>
        <span v-if="hint">{{ hint }}</span>
      </div>
    </CardContent>
  </Card>
</template>
