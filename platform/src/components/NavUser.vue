<script setup>
import { useRouter } from "vue-router";
import { signOut } from '@/stores/auth';
import {
  Building2,
  ChevronsUpDown,
  CreditCard,
  KeyRound,
  LogOut,
  Moon,
  Settings,
  Sun,
  Users,
} from "@lucide/vue";

import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { openSettings } from '@/stores/ui';
import { useTheme } from '@/composables/useTheme';

const props = defineProps({
  user: { type: Object, required: true },
  organization: { type: Object, required: true },
});

const { isMobile } = useSidebar();
const router = useRouter();
const { isDark, toggle } = useTheme();
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar class="h-8 w-8 rounded-lg">
              <AvatarFallback class="rounded-lg bg-primary text-xs text-primary-foreground">{{ user.initials }}</AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ organization.name }}</span>
              <span class="truncate text-xs text-muted-foreground">{{ user.name }} · {{ user.role }}</span>
            </div>
            <ChevronsUpDown class="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-(--reka-dropdown-menu-trigger-width) min-w-60 rounded-lg"
          :side="isMobile ? 'bottom' : 'right'"
          align="end"
          :side-offset="4"
        >
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar class="h-8 w-8 rounded-lg">
                <AvatarFallback class="rounded-lg bg-primary text-xs text-primary-foreground">{{ user.initials }}</AvatarFallback>
              </Avatar>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-semibold">{{ user.name }}</span>
                <span class="truncate text-xs text-muted-foreground">{{ user.email }}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem @click="openSettings('organization')">
              <Settings />
              Settings
              <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem @click="openSettings('organization')">
              <Building2 />
              Organization
            </DropdownMenuItem>
            <DropdownMenuItem @click="openSettings('team')">
              <Users />
              Team members
            </DropdownMenuItem>
            <DropdownMenuItem @click="openSettings('api-keys')">
              <KeyRound />
              API keys
            </DropdownMenuItem>
            <DropdownMenuItem @click="router.push({ name: 'billing' })">
              <CreditCard />
              Billing
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem @select.prevent="toggle">
            <Moon v-if="!isDark" />
            <Sun v-else />
            {{ isDark ? 'Light mode' : 'Dark mode' }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="signOut">
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
