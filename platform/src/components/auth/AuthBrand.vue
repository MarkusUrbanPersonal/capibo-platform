<script setup>
// Brand header for the login-05 / signup-05 forms: mascot and wordmark above the title.
import CapiboLogo from '@/components/brand/CapiboLogo.vue'
import { FieldDescription } from '@/components/ui/field'

defineProps({ title: { type: String, required: true } })
</script>

<template>
  <div class="flex flex-col items-center gap-2 text-center">
    <RouterLink to="/" class="mb-4 flex items-center gap-2 font-medium text-foreground" aria-label="Capibo home">
      <img src="/mascot.png" alt="" class="size-16 shrink-0 object-contain drop-shadow-sm" />
      <CapiboLogo class="h-11 w-auto" />
    </RouterLink>
    <h1 class="text-xl font-bold">{{ title }}</h1>
    <FieldDescription>
      <slot />
    </FieldDescription>
  </div>
</template>
