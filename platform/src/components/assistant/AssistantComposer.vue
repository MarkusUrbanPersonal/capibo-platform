<script setup>
import { nextTick, ref } from 'vue'
import {
  AuiIf,
  ComposerPrimitiveCancel,
  ComposerPrimitiveInput,
  ComposerPrimitiveSend,
  useAui,
} from '@assistant-ui/vue'
import {
  ArrowUpIcon,
  Calculator,
  ChartColumn,
  CircleHelp,
  Gauge,
  ListChecks,
  ListPlus,
  Receipt,
  Send,
  ShieldCheck,
  Sparkles,
  SquareIcon,
  SquareSlash,
  Target,
  TrendingUp,
} from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import ComposerTriggerPopover from './slash/ComposerTriggerPopover.vue'
import { useSlashCommandAdapter } from './slash/useSlashCommandAdapter'
import UsageMeter from './UsageMeter.vue'
import UsageDialog from './UsageDialog.vue'

/**
 * assistant-ui composer with slash commands, wired the way assistant-ui's
 * slash-command guide does it: commands → `useSlashCommandAdapter` → trigger popover.
 * `args` commands insert `/id ` for the user to finish; others send `/id` straight away.
 * `/usage` is handled locally: it opens the usage dialog instead of a reply.
 */
const props = defineProps({
  placeholder: { type: String, default: 'Send a message…' },
  commands: { type: Array, default: () => [] },
  usage: { type: Object, default: null },
  model: { type: String, default: '' },
  size: { type: String, default: 'default' }, // 'default' | 'lg'
})

const ICONS = {
  sparkles: Sparkles,
  'list-checks': ListChecks,
  'list-plus': ListPlus,
  calculator: Calculator,
  send: Send,
  gauge: Gauge,
  help: CircleHelp,
  chart: ChartColumn,
  shield: ShieldCheck,
  target: Target,
  trending: TrendingUp,
  receipt: Receipt,
}

const aui = useAui()
const root = ref(null)
const popover = ref(null)
const usageOpen = ref(false)

function focusInput() {
  nextTick(() => root.value?.querySelector('textarea')?.focus())
}

function execute(cmd) {
  if (cmd.id === 'usage' && props.usage) {
    usageOpen.value = true
  } else if (cmd.args) {
    aui.composer.setText(`/${cmd.id} `)
    focusInput()
  } else {
    aui.composer.setText(`/${cmd.id}`)
    aui.composer.send()
  }
}

const slash = useSlashCommandAdapter({
  commands: () => props.commands.map((c) => ({ ...c, execute: () => execute(c) })),
  removeOnExecute: true,
  iconMap: ICONS,
  fallbackIcon: SquareSlash,
})

function openMenu() {
  popover.value?.open()
  focusInput()
}

defineExpose({ focus: focusInput })
</script>

<template>
  <div ref="root" class="relative w-full" @keydown.capture="(e) => popover?.onKeydown(e)">
    <ComposerTriggerPopover v-if="commands.length" ref="popover" v-bind="slash" />
    <div
      class="flex w-full flex-col gap-2 rounded-2xl border bg-background p-2.5 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] focus-within:border-ring/60 focus-within:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.05)]"
    >
      <ComposerPrimitiveInput
        class="max-h-40 w-full resize-none bg-transparent px-2 py-1 caret-primary outline-none placeholder:text-muted-foreground/80"
        :class="size === 'lg' ? 'min-h-16 text-base' : 'min-h-10 text-sm'"
        :placeholder="placeholder"
        rows="1"
        :aria-label="placeholder"
        :aria-expanded="!!popover?.isOpen"
        aria-controls="slash-commands"
        :aria-activedescendant="popover?.activeId"
      />
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-1">
          <Tooltip v-if="commands.length">
            <TooltipTrigger as-child>
              <button
                type="button"
                class="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Show commands"
                @click="openMenu"
              >
                <SquareSlash class="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Commands</TooltipContent>
          </Tooltip>
          <Badge v-if="model" variant="outline" class="hidden h-6 rounded-full font-mono text-[11px] font-normal text-muted-foreground sm:inline-flex">
            {{ model }}
          </Badge>
        </div>
        <div class="flex items-center gap-1">
          <UsageMeter v-if="usage" :usage="usage" />
          <AuiIf :condition="(s) => !s.thread.isRunning">
            <ComposerPrimitiveSend
              class="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
              aria-label="Send"
            >
              <ArrowUpIcon class="size-4" />
            </ComposerPrimitiveSend>
          </AuiIf>
          <AuiIf :condition="(s) => s.thread.isRunning">
            <ComposerPrimitiveCancel
              class="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
              aria-label="Stop generating"
            >
              <SquareIcon class="size-3 fill-current" />
            </ComposerPrimitiveCancel>
          </AuiIf>
        </div>
      </div>
    </div>
    <UsageDialog v-if="usage" v-model:open="usageOpen" :usage="usage" />
  </div>
</template>
