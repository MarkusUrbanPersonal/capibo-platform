<script setup>
import { useRoute, useRouter } from "vue-router";
import { datasetRoute } from "@/router";
import { toast } from '@/components/ui/toast';
import { Database, Eye, MoreHorizontal, PauseCircle, Plus } from "@lucide/vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { setMissionStatus } from '@/stores/missions';
import { errorMessage } from '@/lib/convex';

defineProps({
  projects: { type: Array, required: true },
});

const { isMobile } = useSidebar();
const route = useRoute();
const router = useRouter();

async function pause(item) {
  try {
    await setMissionStatus(item.id, "paused");
  } catch (e) {
    return toast.add({ title: errorMessage(e), type: "error" });
  }
  toast.add({ title: `${item.name} paused`, description: "Collectors stop receiving new tasks. Resume from the mission page." });
}
</script>

<template>
  <SidebarGroup class="group-data-[collapsible=icon]:hidden">
    <SidebarGroupLabel>Running missions</SidebarGroupLabel>
    <SidebarMenu>
      <SidebarMenuItem v-for="item in projects" :key="item.id">
        <SidebarMenuButton as-child :is-active="route.name === 'mission-detail' && route.params.id === item.id">
          <RouterLink :to="{ name: 'mission-detail', params: { id: item.id } }">
            <span
              class="size-2 shrink-0 rounded-full"
              :class="item.status === 'dispatching' ? 'bg-status-info animate-pulse' : 'bg-status-good'"
              aria-hidden="true"
            />
            <span>{{ item.name }}</span>
          </RouterLink>
        </SidebarMenuButton>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <SidebarMenuAction show-on-hover>
              <MoreHorizontal />
              <span class="sr-only">More for {{ item.name }}</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            class="w-48 rounded-lg"
            :side="isMobile ? 'bottom' : 'right'"
            :align="isMobile ? 'end' : 'start'"
          >
            <DropdownMenuItem @click="router.push({ name: 'mission-detail', params: { id: item.id } })">
              <Eye class="text-muted-foreground" />
              <span>View mission</span>
            </DropdownMenuItem>
            <DropdownMenuItem @click="router.push(datasetRoute(item))">
              <Database class="text-muted-foreground" />
              <span>Open videos</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="pause(item)">
              <PauseCircle class="text-muted-foreground" />
              <span>Pause collection</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton as-child class="text-sidebar-foreground/70">
          <RouterLink :to="{ name: 'missions-new' }">
            <Plus />
            <span>New mission</span>
          </RouterLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarGroup>
</template>
