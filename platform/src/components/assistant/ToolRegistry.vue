<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useAui } from '@assistant-ui/vue'

// Registers Vue tool UIs with assistant-ui (docs: Tool UI → aui.tools.setToolUI).
const props = defineProps({
  tools: { type: Object, default: () => ({}) },
})

const aui = useAui()
let unregister = []
onMounted(() => {
  unregister = Object.entries(props.tools).map(([name, component]) => aui.tools.setToolUI(name, component))
})
onUnmounted(() => unregister.forEach((fn) => fn?.()))
</script>

<template>
  <slot />
</template>
