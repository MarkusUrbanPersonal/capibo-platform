<script setup>
import { useForwardPropsEmits } from "reka-ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Command from "./Command.vue";

const props = defineProps({
  open: { type: Boolean, required: false },
  defaultOpen: { type: Boolean, required: false },
  modal: { type: Boolean, required: false },
  unmountOnHide: { type: Boolean, required: false },
  title: { type: String, required: false, default: "Command Palette" },
  description: {
    type: String,
    required: false,
    default: "Search for a command to run...",
  },
});
const emits = defineEmits(["update:open"]);

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <Dialog v-slot="slotProps" v-bind="forwarded">
    <!-- Input row is 48px tall; the close button (top-4, 16px icon) sits on its center line. -->
    <DialogContent class="overflow-hidden p-0 [&_[data-slot=command-input-wrapper]]:h-12 [&_[data-slot=command-input-wrapper]]:pr-10">
      <DialogHeader class="sr-only">
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>
      <Command>
        <slot v-bind="slotProps" />
      </Command>
    </DialogContent>
  </Dialog>
</template>
