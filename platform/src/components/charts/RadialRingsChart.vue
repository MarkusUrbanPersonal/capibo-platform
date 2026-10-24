<script setup>
import { computed, onMounted, ref } from 'vue'

/**
 * Concentric progress rings, one per item, outermost first.
 * `items`: [{ key, label, value (0–100 or null), color }]
 */
const props = defineProps({
  items: { type: Array, required: true },
  centerValue: { type: String, default: '' },
  centerLabel: { type: String, default: '' },
  size: { type: Number, default: 200 },
})

// Rings thin out as items grow so the innermost one still leaves room for the center label.
const INNER_MIN = props.size * 0.23
const step = computed(() => Math.min(14, (props.size / 2 - INNER_MIN) / Math.max(1, props.items.length)))
const STROKE_RATIO = 0.64
const stroke = computed(() => step.value * STROKE_RATIO)
const outer = computed(() => props.size / 2 - stroke.value / 2)

const rings = computed(() =>
  props.items.map((item, i) => {
    const r = outer.value - i * step.value
    const c = 2 * Math.PI * r
    return { ...item, r, c, dash: (c * Math.min(100, Math.max(0, item.value ?? 0))) / 100 }
  }),
)

// Arcs sweep in from zero once mounted.
const drawn = ref(false)
onMounted(() => requestAnimationFrame(() => (drawn.value = true)))
</script>

<template>
  <div class="relative mx-auto" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :viewBox="`0 0 ${size} ${size}`" class="size-full -rotate-90" role="img" :aria-label="items.map((i) => `${i.label} ${i.value ?? 0}%`).join(', ')">
      <g v-for="ring in rings" :key="ring.key">
        <circle :cx="size / 2" :cy="size / 2" :r="ring.r" fill="none" class="stroke-muted" :stroke-width="stroke" />
        <circle
          :cx="size / 2"
          :cy="size / 2"
          :r="ring.r"
          fill="none"
          :stroke="ring.color"
          :stroke-width="stroke"
          stroke-linecap="round"
          :stroke-dasharray="`${drawn ? ring.dash : 0} ${ring.c}`"
          class="transition-[stroke-dasharray] duration-700 ease-out"
        >
          <title>{{ ring.label }} · {{ ring.value ?? '—' }}%</title>
        </circle>
      </g>
    </svg>
    <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
      <span class="text-2xl font-semibold tracking-tight tabular-nums">{{ centerValue }}</span>
      <span v-if="centerLabel" class="text-[11px] text-muted-foreground">{{ centerLabel }}</span>
    </div>
  </div>
</template>
