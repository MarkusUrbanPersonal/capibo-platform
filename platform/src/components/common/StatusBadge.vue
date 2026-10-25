<script setup>
import { computed } from 'vue'
import { CheckCircle2, XCircle, Clock, PauseCircle, CircleDot, Send, AlertCircle } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'

const props = defineProps({
  status: { type: String, required: true },
})

// Status colors are reserved for state and always ship with an icon + label.
const MAP = {
  active: { label: 'Active', icon: CircleDot, tone: 'good' },
  accepted: { label: 'Accepted', icon: CheckCircle2, tone: 'good' },
  paid: { label: 'Paid', icon: CheckCircle2, tone: 'good' },
  succeeded: { label: 'Succeeded', icon: CheckCircle2, tone: 'good' },
  connected: { label: 'Connected', icon: CheckCircle2, tone: 'good' },
  rejected: { label: 'Rejected', icon: XCircle, tone: 'critical' },
  failed: { label: 'Failed', icon: XCircle, tone: 'critical' },
  processing: { label: 'Processing', icon: Clock, tone: 'warning' },
  pending: { label: 'Pending', icon: Clock, tone: 'warning' },
  paused: { label: 'Paused', icon: PauseCircle, tone: 'warning' },
  dispatching: { label: 'Dispatching', icon: Send, tone: 'info' },
  completed: { label: 'Completed', icon: CheckCircle2, tone: 'neutral' },
}

const TONES = {
  good: 'text-status-good',
  critical: 'text-status-critical',
  warning: 'text-status-warning',
  info: 'text-status-info',
  neutral: 'text-muted-foreground',
}

const cfg = computed(() => MAP[props.status] ?? { label: props.status, icon: AlertCircle, tone: 'neutral' })
</script>

<template>
  <Badge variant="outline" class="gap-1 rounded-full bg-background px-2 font-medium text-foreground">
    <component :is="cfg.icon" class="size-3" :class="TONES[cfg.tone]" aria-hidden="true" />
    {{ cfg.label }}
    <slot />
  </Badge>
</template>
