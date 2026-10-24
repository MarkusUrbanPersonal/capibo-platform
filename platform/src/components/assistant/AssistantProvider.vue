<script setup>
import { AuiConfig, AuiProvider } from '@assistant-ui/vue'
import { RuntimeAdapter, Suggestions } from '@assistant-ui/core/store'
import ToolRegistry from './ToolRegistry.vue'

/**
 * Wires an assistant runtime into assistant-ui's AuiProvider, with optional
 * starter suggestions and Vue tool UIs keyed by tool name.
 */
const props = defineProps({
  assistant: { type: Object, required: true },
  suggestions: { type: Array, default: () => [] },
  tools: { type: Object, default: () => ({}) },
})

const config = AuiConfig({
  threads: RuntimeAdapter(props.assistant.runtime),
  ...(props.suggestions.length ? { suggestions: Suggestions(props.suggestions) } : {}),
})
</script>

<template>
  <AuiProvider :config="config">
    <ToolRegistry :tools="tools">
      <slot />
    </ToolRegistry>
  </AuiProvider>
</template>
