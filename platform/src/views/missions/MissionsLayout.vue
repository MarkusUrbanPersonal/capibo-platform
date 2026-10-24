<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Sparkles, Activity, Archive } from '@lucide/vue'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { allMissions } from '@/stores/missions'

const route = useRoute()
const router = useRouter()

const counts = computed(() => ({
  active: allMissions.value.filter((m) => m.status !== 'completed').length,
  completed: allMissions.value.filter((m) => m.status === 'completed').length,
}))

const tab = computed({
  get: () => route.name,
  set: (name) => router.push({ name }),
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="border-b px-4 md:px-6">
      <div class="mx-auto flex w-full max-w-7xl flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h1 class="text-lg font-semibold tracking-tight">Missions</h1>
        <Tabs v-model="tab" class="max-w-full overflow-x-auto">
          <TabsList>
            <TabsTrigger value="missions-new" class="gap-1.5 px-3"><Sparkles class="size-3.5" /> New mission</TabsTrigger>
            <TabsTrigger value="missions-active" class="gap-1.5 px-3">
              <Activity class="size-3.5" /> Active
              <span class="rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">{{ counts.active }}</span>
            </TabsTrigger>
            <TabsTrigger value="missions-completed" class="gap-1.5 px-3">
              <Archive class="size-3.5" /> Completed
              <span class="rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">{{ counts.completed }}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
    <RouterView />
  </div>
</template>
