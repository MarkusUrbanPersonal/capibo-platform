<script setup>
import { computed } from 'vue'
import { BarChart3, ChevronRight } from '@lucide/vue'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Generic tool UI for analytics queries: a metric strip and/or a small table.
const props = defineProps({
  tool: { type: Object, required: true },
})
const r = computed(() => props.tool.part.result ?? {})
</script>

<template>
  <Card class="my-3 gap-0 overflow-hidden py-0 shadow-none">
    <div class="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-xs">
      <BarChart3 class="size-3.5 text-muted-foreground" />
      <span class="font-medium">{{ r.title }}</span>
      <span class="ml-auto flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
        {{ tool.part.toolName }} <ChevronRight class="size-3" />
      </span>
    </div>
    <div v-if="r.metrics" class="grid grid-cols-2 divide-x divide-y sm:divide-y-0" :class="r.metrics.length > 2 ? 'sm:grid-cols-4' : ''">
      <div v-for="m in r.metrics" :key="m.label" class="px-3 py-2.5">
        <div class="text-[11px] text-muted-foreground">{{ m.label }}</div>
        <div class="text-sm font-semibold tabular-nums">{{ m.value }}</div>
      </div>
    </div>
    <Table v-if="r.rows" class="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead v-for="(c, i) in r.columns" :key="c" class="h-8" :class="[i === 0 ? 'pl-3' : 'text-right', i === r.columns.length - 1 ? 'pr-3' : '']">{{ c }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(row, ri) in r.rows" :key="ri">
          <TableCell v-for="(cell, ci) in row" :key="ci" class="py-1.5" :class="[ci === 0 ? 'pl-3 font-medium' : 'text-right tabular-nums', ci === row.length - 1 ? 'pr-3' : '']">{{ cell }}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </Card>
</template>
