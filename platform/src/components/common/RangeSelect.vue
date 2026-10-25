<script setup>
import { CalendarDays } from '@lucide/vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RANGE_OPTIONS } from '@/lib/ranges'

const model = defineModel({ type: String, default: '30d' })
defineProps({ options: { type: Array, default: () => RANGE_OPTIONS } })
</script>

<template>
  <Select v-model="model">
    <SelectTrigger class="w-[170px] bg-background" aria-label="Date range">
      <CalendarDays class="size-4 text-muted-foreground" />
      <SelectValue />
    </SelectTrigger>
    <SelectContent align="end">
      <SelectItem v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
    </SelectContent>
  </Select>
</template>
