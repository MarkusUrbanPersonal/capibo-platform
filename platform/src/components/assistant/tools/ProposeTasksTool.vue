<script setup>
import { computed, ref } from 'vue'
import { useAui, useAuiState } from '@assistant-ui/vue'
import { Plus, Clock, Video, Check, Lock, Loader2 } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { planner } from '@/stores/missions'
import { makeTask } from '@/services/assistant/missionAgent'
import { visualFor } from '@/lib/visuals'
import { formatCurrency, formatNumber } from '@/lib/format'

const props = defineProps({
  tool: { type: Object, required: true },
})

const aui = useAui()
const isRunning = useAuiState((s) => s.thread.isRunning)

// Only the latest plan card is editable; earlier cards are snapshots.
const editable = computed(
  () => planner.planCallId === props.tool.part.toolCallId && !planner.launchedMissionId,
)
// A cancelled run leaves `drafting` set, so also require the thread to be running.
const drafting = computed(() => props.tool.part.result?.drafting && isRunning.value)
const plan = computed(() => (editable.value ? planner.plan : props.tool.part.args))
const tasks = computed(() => plan.value?.tasks ?? [])
const active = computed(() => tasks.value.filter((t) => t.enabled))
const totalVideos = computed(() => active.value.reduce((s, t) => s + Number(t.videos || 0), 0))
const subtotal = computed(() => active.value.reduce((s, t) => s + Number(t.videos || 0) * t.price, 0))
const added = computed(() => new Set(props.tool.part.result?.added ?? []))

const newTask = ref('')
function addTask() {
  const name = newTask.value.trim()
  if (!name) return
  planner.plan.tasks.push(makeTask(name, planner.plan.tasks.length))
  planner.estimate = null
  newTask.value = ''
}

function onEdit() {
  planner.estimate = null
}

function approve() {
  aui.thread.append(`Looks good — approve the plan with ${active.value.length} tasks and estimate the cost.`)
}
</script>

<template>
  <section class="my-3 w-full">
    <header class="mb-3 flex items-start justify-between gap-3 px-0.5">
      <div class="min-w-0">
        <h3 class="text-base font-semibold tracking-tight">{{ plan?.name ?? 'Task plan' }}</h3>
        <p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{{ plan?.objective }}</p>
      </div>
      <Badge v-if="!editable" variant="outline" class="shrink-0 gap-1 text-muted-foreground">
        <Lock class="size-3" /> Snapshot
      </Badge>
      <Badge v-else-if="drafting" variant="secondary" class="shrink-0 gap-1">
        <Loader2 class="size-3 animate-spin" /> Drafting
      </Badge>
      <Badge v-else variant="secondary" class="shrink-0">Draft</Badge>
    </header>

    <ul class="grid gap-2.5 sm:grid-cols-2">
      <li
        v-for="(task, i) in tasks"
        :key="task.id"
        class="rise-in flex flex-col gap-3 rounded-xl border bg-card p-3.5 transition-[opacity,box-shadow] hover:shadow-sm"
        :class="{ 'opacity-45': !task.enabled }"
        :style="{ animationDelay: drafting ? '0ms' : `${Math.min(i, 8) * 45}ms` }"
      >
        <div class="flex items-start gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg" :class="visualFor(task.name, task).tone">
            <component :is="visualFor(task.name, task).icon" class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="truncate text-sm font-medium">{{ task.name }}</span>
              <Badge v-if="added.has(task.name)" variant="outline" class="h-5 px-1.5 text-[10px]">New</Badge>
            </div>
            <p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{{ task.description }}</p>
          </div>
          <Switch
            v-if="editable"
            v-model="task.enabled"
            :aria-label="`Include ${task.name}`"
            @update:model-value="onEdit"
          />
        </div>
        <div class="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span class="flex items-center gap-1"><Clock class="size-3" /> {{ task.duration[0] }}–{{ task.duration[1] }}s</span>
          <span class="flex items-center gap-1.5">
            <Video class="size-3.5" />
            <Input
              v-if="editable"
              v-model.number="task.videos"
              type="number"
              min="0"
              step="10"
              :aria-label="`Videos for ${task.name}`"
              class="h-7 w-20 text-right text-xs tabular-nums"
              :disabled="!task.enabled"
              @update:model-value="onEdit"
            />
            <span v-else class="tabular-nums text-foreground">{{ formatNumber(task.videos) }}</span>
            videos
          </span>
        </div>
      </li>
      <li
        v-if="drafting"
        class="rise-in flex min-h-[112px] items-center justify-center gap-2 rounded-xl border border-dashed text-xs text-muted-foreground"
      >
        <Loader2 class="size-3.5 animate-spin" /> Drafting next task…
      </li>
    </ul>

    <template v-if="!drafting">
      <form v-if="editable" class="mt-2.5 flex gap-2" @submit.prevent="addTask">
        <Input v-model="newTask" placeholder="Add a task, e.g. pairing socks" class="h-9 text-sm" />
        <Button type="submit" variant="outline" size="sm" class="h-9" :disabled="!newTask.trim()">
          <Plus class="size-4" /> Add
        </Button>
      </form>

      <footer class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-3.5 py-2.5">
        <div class="text-xs text-muted-foreground">
          <span class="font-medium text-foreground tabular-nums">{{ active.length }}</span> tasks ·
          <span class="font-medium text-foreground tabular-nums">{{ formatNumber(totalVideos) }}</span> videos ·
          ~<span class="tabular-nums">{{ formatCurrency(subtotal) }}</span> collection
        </div>
        <Button v-if="editable" size="sm" :disabled="isRunning || active.length === 0" @click="approve">
          <Check class="size-4" /> Approve plan
        </Button>
      </footer>
    </template>
  </section>
</template>
