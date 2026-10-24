<script setup>
import {
  AuiIf,
  SuggestionPrimitiveDescription,
  SuggestionPrimitiveTitle,
  SuggestionPrimitiveTrigger,
  ThreadPrimitiveMessages,
  ThreadPrimitiveScrollToBottom,
  ThreadPrimitiveSuggestions,
  ThreadPrimitiveViewport,
  useAuiState,
} from '@assistant-ui/vue'
import { ArrowDownIcon } from '@lucide/vue'
import Message from '@/components/assistant-ui/message.vue'
import AssistantComposer from './AssistantComposer.vue'

/**
 * Thread layout adapted from the assistant-ui registry `thread.vue`:
 * a centered composer while empty, then a scrolling message list with
 * the composer pinned to the bottom.
 */
defineProps({
  placeholder: { type: String, default: 'Send a message…' },
  commands: { type: Array, default: () => [] },
  usage: { type: Object, default: null },
  model: { type: String, default: '' },
  compact: { type: Boolean, default: false },
  showSuggestions: { type: Boolean, default: true },
})

const isEmpty = useAuiState((s) => s.thread.messages.length === 0)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <!-- Empty state: just the input -->
    <div v-if="isEmpty" class="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4" :class="compact ? 'py-6' : 'pb-[10vh]'">
      <div class="flex w-full flex-col gap-6" :class="compact ? 'max-w-full' : 'max-w-2xl'">
        <slot name="empty" />
        <AssistantComposer :placeholder="placeholder" :commands="commands" :usage="usage" :model="model" :size="compact ? 'default' : 'lg'" />
        <div v-if="showSuggestions" class="flex flex-wrap gap-2" :class="compact ? '' : 'justify-center'">
          <ThreadPrimitiveSuggestions>
            <SuggestionPrimitiveTrigger
              send
              class="flex h-auto flex-col items-start gap-0.5 rounded-xl border bg-background px-3.5 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <span class="font-medium"><SuggestionPrimitiveTitle /></span>
              <span class="text-xs text-muted-foreground"><SuggestionPrimitiveDescription /></span>
            </SuggestionPrimitiveTrigger>
          </ThreadPrimitiveSuggestions>
        </div>
      </div>
    </div>

    <template v-else>
      <ThreadPrimitiveViewport class="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth">
        <div class="mx-auto flex w-full flex-1 flex-col px-4" :class="compact ? 'pt-4' : 'max-w-3xl pt-8'">
          <ol class="mb-4 flex flex-col gap-y-6 empty:hidden" aria-live="polite">
            <ThreadPrimitiveMessages>
              <Message />
            </ThreadPrimitiveMessages>
          </ol>
          <ThreadPrimitiveScrollToBottom
            class="sticky bottom-2 z-10 mx-auto rounded-full border bg-background p-2 shadow-sm transition-[opacity,visibility] disabled:invisible disabled:opacity-0"
            aria-label="Scroll to bottom"
          >
            <ArrowDownIcon class="size-4" />
          </ThreadPrimitiveScrollToBottom>
        </div>
      </ThreadPrimitiveViewport>
      <div class="mx-auto w-full px-4 pb-4" :class="compact ? '' : 'max-w-3xl'">
        <AssistantComposer :placeholder="placeholder" :commands="commands" :usage="usage" :model="model" />
        <AuiIf :condition="(s) => s.thread.isRunning">
          <p class="mt-2 text-center text-[11px] text-muted-foreground">Agent is working… press Stop to interrupt.</p>
        </AuiIf>
      </div>
    </template>
  </div>
</template>
