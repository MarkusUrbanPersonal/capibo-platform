<script setup>
import { computed } from "vue";
import {
  BookOpen,
  CreditCard,
  Database,
  Gauge,
  House,
  LifeBuoy,
  Target,
} from "@lucide/vue";

import NavMain from '@/components/NavMain.vue';
import NavProjects from '@/components/NavProjects.vue';
import NavSecondary from '@/components/NavSecondary.vue';
import NavUser from '@/components/NavUser.vue';
import CapiboLogo from '@/components/brand/CapiboLogo.vue';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { allMissions } from '@/stores/missions';
import { resetAssistant } from '@/services/assistant';
import { currentUser, organization } from '@/stores/session';

const props = defineProps({
  side: { type: String, required: false },
  variant: { type: String, required: false, default: "inset" },
  collapsible: { type: String, required: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});

const navMain = [
  { title: "Home", to: { name: "home" }, match: ["home"], icon: House },
  {
    title: "Missions",
    to: { name: "missions-active" },
    match: ["missions-new", "missions-active", "missions-completed", "mission-detail"],
    icon: Target,
    items: [
      // Starting a new mission from the sidebar always opens a fresh chat.
      { title: "New mission", to: { name: "missions-new" }, onClick: () => resetAssistant("missions") },
      { title: "Active", to: { name: "missions-active" } },
      { title: "Completed", to: { name: "missions-completed" } },
    ],
  },
  { title: "Datasets", to: { name: "datasets" }, match: ["datasets", "dataset-detail"], icon: Database },
  { title: "Usage", to: { name: "usage" }, match: ["usage"], icon: Gauge },
  { title: "Billing", to: { name: "billing" }, match: ["billing"], icon: CreditCard },
];

// Quick links to the missions that are collecting right now.
const activeMissions = computed(() =>
  allMissions.value
    .filter((m) => m.status === "active" || m.status === "dispatching")
    .slice(0, 5)
    .map((m) => ({ id: m.id, name: m.name, status: m.status, datasetId: m.datasetId })),
);

const navSecondary = [
  { title: "API reference", url: "https://docs.capibo.work/api-reference/introduction", icon: BookOpen },
  { title: "Help & support", url: "mailto:support@capibo.work", icon: LifeBuoy },
];
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child class="h-14 hover:bg-transparent active:bg-transparent">
            <RouterLink :to="{ name: 'home' }" aria-label="Capibo home">
              <span class="flex min-w-0 items-center group-data-[collapsible=icon]:hidden">
                <CapiboLogo class="h-8 w-auto text-sidebar-foreground" />
              </span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="navMain" />
      <NavProjects :projects="activeMissions" />
      <NavSecondary :items="navSecondary" class="mt-auto" />
    </SidebarContent>
    <SidebarFooter>
      <NavUser :user="currentUser" :organization="organization" />
    </SidebarFooter>
  </Sidebar>
</template>
