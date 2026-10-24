<script setup>
import { markRaw } from 'vue'
import { RotateCcw, Sparkles } from '@lucide/vue'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import AssistantProvider from './AssistantProvider.vue'
import AssistantThread from './AssistantThread.vue'
import DataResultTool from './tools/DataResultTool.vue'
import { getAssistant } from '@/services/assistant'
import { analyticsAgent, ANALYTICS_COMMANDS, ANALYTICS_MODEL } from '@/services/assistant/analyticsAgent'

/** Side panel with the analytics assistant (assistant-ui thread). */
const open = defineModel('open', { type: Boolean, default: false })
const props = defineProps({
  context: { type: String, required: true }, // 'usage' | 'billing'
  suggestions: { type: Array, default: () => [] },
})

const assistant = getAssistant(`analytics-${props.context}`, { agent: analyticsAgent, model: ANALYTICS_MODEL })
const DataTool = markRaw(DataResultTool)
const tools = {
  query_usage: DataTool,
  query_quality: DataTool,
  usage_by_mission: DataTool,
  forecast_spend: DataTool,
  list_invoices: DataTool,
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
      <SheetHeader class="border-b pr-12">
        <div class="flex items-center justify-between gap-2">
          <SheetTitle class="flex items-center gap-2"><Sparkles class="size-4" /> Ask Capibo</SheetTitle>
          <Button variant="ghost" size="sm" class="h-7 text-muted-foreground" @click="assistant.reset()">
            <RotateCcw class="size-3.5" /> Reset
          </Button>
        </div>
        <SheetDescription>Questions about {{ context === 'billing' ? 'spend, invoices and credits' : 'consumption, quality and missions' }}, answered from your data.</SheetDescription>
      </SheetHeader>
      <AssistantProvider :assistant="assistant" :suggestions="suggestions" :tools="tools">
        <AssistantThread
          class="min-h-0 flex-1"
          compact
          placeholder="Ask about your data…"
          :commands="ANALYTICS_COMMANDS"
          :usage="assistant.usage"
          :model="ANALYTICS_MODEL"
        >
          <template #empty>
            <div>
              <p class="text-base font-semibold">What would you like to know?</p>
              <p class="mt-1 text-sm text-muted-foreground">The analyst reads the same numbers as this page.</p>
            </div>
          </template>
        </AssistantThread>
      </AssistantProvider>
    </SheetContent>
  </Sheet>
</template>
