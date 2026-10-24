<script setup>
// Centered page shared by the login-05 and signup-05 blocks; the brand lives in each form's header.
</script>

<template>
  <div class="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
    <div class="w-full max-w-sm">
      <slot />
    </div>
  </div>
</template>
