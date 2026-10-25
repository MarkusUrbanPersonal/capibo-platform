<script setup>
import { markRaw } from 'vue'
import { RotateCcw } from '@lucide/vue'
import AssistantProvider from '@/components/assistant/AssistantProvider.vue'
import AssistantThread from '@/components/assistant/AssistantThread.vue'
import AgentStepsTool from '@/components/assistant/tools/AgentStepsTool.vue'
import ProposeTasksTool from '@/components/assistant/tools/ProposeTasksTool.vue'
import CostEstimateTool from '@/components/assistant/tools/CostEstimateTool.vue'
import DispatchTool from '@/components/assistant/tools/DispatchTool.vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getAssistant } from '@/services/assistant'
import { missionAgent, PLANNER_MODEL, SLASH_COMMANDS } from '@/services/assistant/missionAgent'
import { resetPlanner } from '@/stores/missions'

const assistant = getAssistant('missions', { agent: missionAgent, model: PLANNER_MODEL, onReset: resetPlanner })
// Every visit to this view starts a fresh mission conversation.
assistant.reset()

const tools = {
  agent_steps: markRaw(AgentStepsTool),
  propose_tasks: markRaw(ProposeTasksTool),
  estimate_cost: markRaw(CostEstimateTool),
  dispatch_mission: markRaw(DispatchTool),
}
</script>

<template>
  <AssistantProvider :assistant="assistant" :tools="tools">
    <div class="relative flex h-[calc(100svh-9.6rem)] min-h-[480px] flex-col sm:h-[calc(100svh-7.35rem)] md:h-[calc(100svh-8.35rem)]">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="absolute top-2 right-3 z-20 size-8 text-muted-foreground md:right-5"
            aria-label="New chat"
            @click="assistant.reset()"
          >
            <RotateCcw class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">New chat</TooltipContent>
      </Tooltip>

      <AssistantThread
        class="min-h-0 flex-1"
        placeholder="Describe what your robot should learn…"
        :commands="SLASH_COMMANDS"
        :usage="assistant.usage"
        :model="PLANNER_MODEL"
        :show-suggestions="false"
      >
        <template #empty>
          <div class="mb-4 text-center">
            <h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">What should your robot learn?</h2>
          </div>
        </template>
      </AssistantThread>
    </div>
  </AssistantProvider>
</template>
