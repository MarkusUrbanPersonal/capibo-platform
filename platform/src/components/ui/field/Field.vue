<script setup>
import { cn } from "cn";
import { fieldVariants } from ".";

const props = defineProps({
  orientation: { type: String, required: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});
</script>

<template>
  <div
    role="group"
    data-slot="field"
    :data-orientation="orientation ?? 'vertical'"
    :class="cn(fieldVariants({ orientation }), props.class)"
  >
    <slot />
  </div>
</template>
