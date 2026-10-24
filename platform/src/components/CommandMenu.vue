<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useEventListener } from '@vueuse/core'
import { House, Target, Sparkles, Database, Gauge, CreditCard, Settings, Users, KeyRound, Moon, Search, Download } from '@lucide/vue'
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from '@/components/ui/command'
import { allMissions } from '@/stores/missions'
import { openSettings } from '@/stores/ui'
import { useTheme } from '@/composables/useTheme'

const open = ref(false)
const router = useRouter()
const { toggle } = useTheme()

useEventListener(window, 'keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    open.value = !open.value
  }
})

const pages = [
  { label: 'Home', icon: House, to: { name: 'home' } },
  { label: 'New mission', icon: Sparkles, to: { name: 'missions-new' } },
  { label: 'Active missions', icon: Target, to: { name: 'missions-active' } },
  { label: 'Datasets', icon: Database, to: { name: 'datasets' } },
  { label: 'Usage', icon: Gauge, to: { name: 'usage' } },
  { label: 'Billing', icon: CreditCard, to: { name: 'billing' } },
]
const missionItems = computed(() => allMissions.value.slice(0, 8))

function run(fn) {
  open.value = false
  fn()
}

defineExpose({ open: () => (open.value = true) })
</script>

<template>
  <button
    type="button"
    class="hidden h-8 w-56 items-center gap-2 rounded-md border bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
    @click="open = true"
  >
    <Search class="size-3.5" />
    <span class="flex-1 text-left">Search or jump to…</span>
    <kbd class="rounded border bg-background px-1.5 font-mono text-[10px]">Ctrl K</kbd>
  </button>

  <CommandDialog v-model:open="open" title="Command palette" description="Navigate Capibo or run an action">
    <CommandInput placeholder="Type a command or search…" />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup heading="Navigate">
        <CommandItem v-for="p in pages" :key="p.label" :value="p.label" @select="run(() => router.push(p.to))">
          <component :is="p.icon" /> {{ p.label }}
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Missions">
        <CommandItem v-for="m in missionItems" :key="m.id" :value="`${m.name} ${m.id}`" @select="run(() => router.push({ name: 'mission-detail', params: { id: m.id } }))">
          <Target /> {{ m.name }}
          <CommandShortcut class="font-mono">{{ m.id }}</CommandShortcut>
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Actions">
        <CommandItem value="Export dataset" @select="run(() => router.push({ name: 'datasets' }))"><Download /> Export dataset</CommandItem>
        <CommandItem value="Open settings" @select="run(() => openSettings())"><Settings /> Settings <CommandShortcut>Ctrl ,</CommandShortcut></CommandItem>
        <CommandItem value="Invite team member" @select="run(() => openSettings('team'))"><Users /> Invite team member</CommandItem>
        <CommandItem value="Manage API keys" @select="run(() => openSettings('api-keys'))"><KeyRound /> Manage API keys</CommandItem>
        <CommandItem value="Toggle dark mode" @select="run(toggle)"><Moon /> Toggle dark mode</CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
