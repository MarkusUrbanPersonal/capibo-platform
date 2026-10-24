<script setup>
import { ToastAction, ToastClose, ToastDescription, ToastRoot, ToastTitle, useToastManager } from 'reka-ui'
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert, X } from '@lucide/vue'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const { toasts } = useToastManager()

const ICONS = {
  success: { icon: CircleCheck, class: 'text-status-good' },
  error: { icon: OctagonX, class: 'text-destructive' },
  warning: { icon: TriangleAlert, class: 'text-status-warning' },
  info: { icon: Info, class: 'text-status-info' },
  loading: { icon: Loader2, class: 'animate-spin text-muted-foreground' },
}
</script>

<template>
  <ToastRoot
    v-for="t in toasts"
    :key="t.id"
    :toast="t"
    data-slot="toast"
    class="group overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg select-none"
  >
    <div data-slot="toast-content" class="flex items-start gap-3 p-4 pr-9">
      <component :is="ICONS[t.status].icon" v-if="ICONS[t.status]" class="mt-0.5 size-4 shrink-0" :class="ICONS[t.status].class" aria-hidden="true" />
      <div class="grid min-w-0 flex-1 gap-1">
        <ToastTitle v-if="t.title" class="text-sm leading-5 font-medium" />
        <ToastDescription v-if="t.description" class="text-sm leading-5 text-muted-foreground" />
      </div>
      <ToastAction
        v-if="t.actionProps"
        :class="cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 shrink-0 px-2.5 text-xs')"
      />
    </div>
    <ToastClose
      class="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      aria-label="Close"
    >
      <X class="size-3.5" />
    </ToastClose>
  </ToastRoot>
</template>
