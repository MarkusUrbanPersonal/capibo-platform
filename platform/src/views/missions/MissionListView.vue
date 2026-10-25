<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { datasetRoute } from '@/router'
import { Plus, MoreHorizontal, Eye, Database, PauseCircle, PlayCircle, Target, Trash2 } from '@lucide/vue'
import { toast } from '@/components/ui/toast'
import { errorMessage } from '@/lib/convex'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { Button } from '@/components/ui/button'
import DeleteMissionDialog from '@/components/missions/DeleteMissionDialog.vue'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { allMissions, missionsLoaded, setMissionStatus } from '@/stores/missions'
import { visualFor } from '@/lib/visuals'
import { formatDate, formatNumber } from '@/lib/format'

const props = defineProps({
  scope: { type: String, default: 'active' }, // 'active' | 'completed'
})

const router = useRouter()
const filtered = computed(() =>
  allMissions.value.filter((m) => (props.scope === 'completed' ? m.status === 'completed' : m.status !== 'completed')),
)

const toDelete = ref(null)
const deleteOpen = ref(false)
function askDelete(m) {
  toDelete.value = m
  deleteOpen.value = true
}

const open = (m) => router.push({ name: 'mission-detail', params: { id: m.id } })
const isNew = (m) => Date.now() - m.createdAt < 86_400_000

async function setStatus(m, next) {
  try {
    await setMissionStatus(m.id, next)
  } catch (e) {
    return toast.add({ title: errorMessage(e), type: 'error' })
  }
  if (next === 'paused') toast.add({ title: `${m.name} paused`, description: 'Collectors stop receiving new tasks.' })
  else toast.add({ title: `${m.name} resumed`, type: 'success' })
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pt-8 pb-6 md:px-6 md:pt-10">
    <ul v-if="filtered.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <li
        v-for="(m, i) in filtered"
        :key="m.id"
        class="rise-in group relative flex cursor-pointer flex-col gap-4 rounded-xl border bg-card p-4 transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        :style="{ animationDelay: `${Math.min(i, 9) * 35}ms` }"
        tabindex="0"
        @click="open(m)"
        @keydown.enter="open(m)"
      >
        <div class="flex items-start gap-3">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-xl" :class="visualFor(m.name, m).tone">
            <component :is="visualFor(m.name, m).icon" class="size-5" aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="truncate font-medium">{{ m.name }}</span>
              <span v-if="isNew(m)" class="shrink-0 rounded-full bg-status-info/10 px-1.5 text-[10px] font-medium text-status-info">New</span>
            </div>
            <div class="mt-0.5 text-xs text-muted-foreground">{{ m.tasks.length }} tasks · {{ scope === 'completed' ? 'Completed' : 'Started' }} {{ formatDate(m.end ?? m.start) }}</div>
          </div>
          <div @click.stop>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon" class="-mt-1 -mr-1 size-8 text-muted-foreground" :aria-label="`Actions for ${m.name}`"><MoreHorizontal class="size-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="open(m)"><Eye class="size-4" /> View details</DropdownMenuItem>
                <DropdownMenuItem @click="router.push(datasetRoute(m))"><Database class="size-4" /> Browse videos</DropdownMenuItem>
                <template v-if="m.status !== 'completed'">
                  <DropdownMenuSeparator />
                  <DropdownMenuItem v-if="m.status === 'paused'" @click="setStatus(m, 'active')"><PlayCircle class="size-4" /> Resume</DropdownMenuItem>
                  <DropdownMenuItem v-else @click="setStatus(m, 'paused')"><PauseCircle class="size-4" /> Pause</DropdownMenuItem>
                </template>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" @click="askDelete(m)"><Trash2 class="size-4" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div class="mt-auto flex items-center justify-between text-xs">
          <StatusBadge :status="m.status">
            <span v-if="m.status !== 'completed'" class="tabular-nums text-muted-foreground" :aria-label="`${m.progress}% of target`">· {{ m.progress }}%</span>
          </StatusBadge>
          <span class="tabular-nums text-muted-foreground">
            <span class="font-medium text-foreground">{{ formatNumber(m.accepted) }}</span> / {{ formatNumber(m.target) }}
          </span>
        </div>
      </li>
    </ul>

    <p v-else-if="!missionsLoaded" class="py-16 text-center text-sm text-muted-foreground" role="status">Loading missions…</p>

    <div v-else class="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span class="flex size-11 items-center justify-center rounded-xl bg-muted"><Target class="size-5 text-muted-foreground" /></span>
      <div>
        <p class="font-medium">{{ scope === 'completed' ? 'No completed missions yet' : 'No active missions' }}</p>
        <p class="mt-1 text-sm text-muted-foreground">Describe a robot behavior and Capibo plans the data collection.</p>
      </div>
      <Button v-if="scope === 'active'" variant="outline" size="sm" @click="router.push({ name: 'missions-new' })"><Plus class="size-4" /> New mission</Button>
    </div>

    <DeleteMissionDialog v-model:open="deleteOpen" :mission="toDelete" />
  </div>
</template>
