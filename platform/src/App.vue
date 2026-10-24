<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useEventListener } from '@vueuse/core'
import { ConfigProvider } from 'reka-ui'
import { BookOpen, Moon, Settings, Sun } from '@lucide/vue'
import AppSidebar from '@/components/AppSidebar.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import CommandMenu from '@/components/CommandMenu.vue'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/toast'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { openSettings } from '@/stores/ui'
import { useTheme } from '@/composables/useTheme'

const route = useRoute()
const { isDark, toggle } = useTheme()

// Breadcrumb trail derived from the matched routes, as in the sidebar-08 page.
const crumbs = computed(() => {
  const trail = []
  const parent = route.matched.find((r) => r.meta?.title && r !== route.matched.at(-1))
  if (parent) trail.push({ title: parent.meta.title, to: parent.path })
  if (route.meta.parent) trail.push(route.meta.parent)
  if (route.name !== 'home') trail.push({ title: route.meta.crumb?.(route) ?? route.meta.title })
  return trail
})

// ⌘, / Ctrl+, opens settings, as in most developer platforms.
useEventListener(window, 'keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === ',') {
    e.preventDefault()
    openSettings()
  }
})
</script>

<template>
  <!-- html already reserves the scrollbar gutter (style.css), so dialogs must not pad the body again -->
  <ConfigProvider :scroll-body="false">
  <RouterView v-if="route.meta.layout === 'auth'" />
  <SidebarProvider v-else>
    <AppSidebar />
    <SidebarInset class="min-w-0">
      <header class="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div class="flex flex-1 items-center gap-2 px-4">
          <SidebarTrigger class="-ml-1" />
          <Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem :class="crumbs.length ? 'hidden md:block' : ''">
                <BreadcrumbLink v-if="crumbs.length" as-child>
                  <RouterLink to="/">Timefactories</RouterLink>
                </BreadcrumbLink>
                <BreadcrumbPage v-else>Home</BreadcrumbPage>
              </BreadcrumbItem>
              <template v-for="(c, i) in crumbs" :key="c.title">
                <BreadcrumbSeparator :class="i < crumbs.length - 1 ? 'hidden md:block' : 'hidden md:block'" />
                <BreadcrumbItem :class="i < crumbs.length - 1 ? 'hidden md:block' : ''">
                  <BreadcrumbLink v-if="c.to && i < crumbs.length - 1" as-child>
                    <RouterLink :to="c.to">{{ c.title }}</RouterLink>
                  </BreadcrumbLink>
                  <BreadcrumbPage v-else>{{ c.title }}</BreadcrumbPage>
                </BreadcrumbItem>
              </template>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div class="flex items-center gap-1 px-3">
          <CommandMenu />
          <Button variant="ghost" size="sm" as="a" href="https://docs.capibo.work" target="_blank" rel="noopener noreferrer" class="hidden text-muted-foreground sm:inline-flex">
            <BookOpen class="size-4" /> Docs
          </Button>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="size-8 text-muted-foreground" :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggle">
                <Sun v-if="isDark" class="size-4" />
                <Moon v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle theme</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="size-8 text-muted-foreground" aria-label="Open settings" @click="openSettings()">
                <Settings class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings <kbd class="ml-1 font-mono text-[10px] opacity-70">Ctrl ,</kbd></TooltipContent>
          </Tooltip>
        </div>
      </header>
      <main class="flex min-w-0 flex-1 flex-col">
        <RouterView v-slot="{ Component }">
          <component :is="Component" />
        </RouterView>
      </main>
    </SidebarInset>
    <SettingsDialog />
    <Toaster />
  </SidebarProvider>
  </ConfigProvider>
</template>
