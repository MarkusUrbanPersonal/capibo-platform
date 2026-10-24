<script setup>
import { ToastPortal, ToastProvider, ToastViewport } from 'reka-ui'
import { cn } from '@/lib/utils'
import ToastList from './ToastList.vue'
import { toastManager } from './manager'

const props = defineProps({
  duration: { type: Number, default: 5000 },
  limit: { type: Number, default: 3 },
  class: { type: String, required: false },
})
</script>

<template>
  <ToastProvider :toast-manager="toastManager" :duration="duration" :limit="limit" swipe-direction="right">
    <ToastList />
    <ToastPortal>
      <ToastViewport
        :class="cn('fixed right-4 bottom-4 z-[100] w-[calc(100vw-2rem)] outline-none sm:w-[360px]', props.class)"
      />
    </ToastPortal>
  </ToastProvider>
</template>

<style>
/* Stacked toasts (shadcn/ui Toast, Base UI style): collapsed into a deck, fanned out on hover or focus. */
[data-slot='toast'] {
  --toast-peek: 10px;
  --toast-gap: 10px;
  --toast-ease: cubic-bezier(0.22, 1, 0.36, 1);
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: calc(1000 - var(--reka-toast-index, 0));
  height: var(--reka-toast-frontmost-height, auto);
  transform-origin: bottom center;
  transform: translateX(var(--reka-toast-swipe-move-x, 0))
    translateY(calc(var(--reka-toast-index, 0) * var(--toast-peek) * -1))
    scale(calc(1 - var(--reka-toast-index, 0) * 0.05));
  transition:
    transform 0.4s var(--toast-ease),
    opacity 0.4s var(--toast-ease),
    height 0.3s var(--toast-ease);
}
[data-slot='toast'] [data-slot='toast-content'] {
  /* Only the front toast's content shows while collapsed. */
  opacity: calc(1 - min(var(--reka-toast-index, 0), 1));
  transition: opacity 0.3s var(--toast-ease);
}
[data-slot='toast'][data-expanded] {
  height: var(--reka-toast-height, auto);
  transform: translateX(var(--reka-toast-swipe-move-x, 0))
    translateY(calc((var(--reka-toast-offset-y, 0px) + var(--reka-toast-index, 0) * var(--toast-gap)) * -1));
}
[data-slot='toast'][data-expanded] [data-slot='toast-content'] {
  opacity: 1;
}
[data-slot='toast'][data-limited] {
  opacity: 0;
  pointer-events: none;
}
[data-slot='toast'][data-state='open'] {
  animation: toast-in 0.4s var(--toast-ease);
}
[data-slot='toast'][data-state='closed'] {
  opacity: 0;
}
[data-slot='toast'][data-swipe='move'] {
  transition: none;
}
[data-slot='toast'][data-swipe='end'] {
  transform: translateX(var(--reka-toast-swipe-end-x, 0));
  opacity: 0;
}
@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  [data-slot='toast'],
  [data-slot='toast'] [data-slot='toast-content'] {
    animation: none;
    transition: none;
  }
}
</style>
