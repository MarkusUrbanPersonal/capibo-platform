<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight, ArrowUpRight, BookOpen, Database, Gauge, KeyRound, Sparkles, Target, Users, Wallet,
} from '@lucide/vue'
import { api } from '@convex/_generated/api'
import { useQuery } from '@/lib/convex'
import { sumRows } from '@/lib/usage'
import { currentUser } from '@/stores/session'
import { TONES } from '@/lib/visuals'
import { formatNumber, isoToday } from '@/lib/format'
import { openSettings } from '@/stores/ui'

const router = useRouter()
const firstName = computed(() => currentUser.value?.name.split(' ')[0] ?? '')
const greeting = (() => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
})()

// Main journeys, in the order a new team usually takes them.
const steps = [
  {
    title: 'Create a mission',
    description: 'Describe what your robot should learn. Capibo plans the videos and shows the cost first.',
    icon: Sparkles,
    tone: TONES.violet,
    action: () => router.push({ name: 'missions-new' }),
  },
  {
    title: 'Track your missions',
    description: 'Follow collection progress and pause or resume missions at any time.',
    icon: Target,
    tone: TONES.sky,
    action: () => router.push({ name: 'missions-active' }),
  },
  {
    title: 'Browse your datasets',
    description: 'Review accepted videos and export them to your training pipeline.',
    icon: Database,
    tone: TONES.emerald,
    action: () => router.push({ name: 'datasets' }),
  },
  {
    title: 'Add credits',
    description: 'Top up your balance or turn on auto-recharge so missions never pause.',
    icon: Wallet,
    tone: TONES.amber,
    action: () => router.push({ name: 'billing' }),
  },
]

const shortcuts = [
  { title: 'Usage', icon: Gauge, action: () => router.push({ name: 'usage' }) },
  { title: 'Invite your team', icon: Users, action: () => openSettings('team') },
  { title: 'API keys', icon: KeyRound, action: () => openSettings('api-keys') },
  { title: 'Documentation', icon: BookOpen, href: 'https://docs.capibo.work' },
]

// Last 30 days, with accepted green, processing yellow and rejected red.
const { data: usage } = useQuery(api.usage.overview, () => ({ today: isoToday(), days: 30 }))
const totals = computed(() => sumRows(usage.value?.daily ?? []))
const glance = computed(() => [
  { label: 'Accepted', value: totals.value.accepted, dot: 'bg-status-good' },
  { label: 'Processing', value: totals.value.processing, dot: 'bg-status-warning' },
  { label: 'Rejected', value: totals.value.rejected, dot: 'bg-status-critical' },
])
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 pt-10 pb-10 md:px-6 md:pt-14 md:pb-12">
    <section class="flex flex-col items-center text-center">
      <img src="/mascot.png" alt="" class="size-20 object-contain" />
      <h1 class="mt-4 text-3xl font-semibold tracking-tight">{{ greeting }}, {{ firstName }}</h1>
      <p class="mt-2 text-sm text-muted-foreground sm:whitespace-nowrap">Turn everyday tasks into training data for your robots. Here's where to go next.</p>
    </section>

    <section aria-label="Get started" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <button
        v-for="(s, i) in steps"
        :key="s.title"
        type="button"
        class="rise-in group flex flex-col items-start gap-4 rounded-xl border bg-card p-5 text-left transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        :style="{ animationDelay: `${i * 50}ms` }"
        @click="s.action"
      >
        <span class="flex size-11 shrink-0 items-center justify-center rounded-xl" :class="s.tone">
          <component :is="s.icon" class="size-5" aria-hidden="true" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5 font-medium">
            {{ s.title }}
            <ArrowRight class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
          </span>
          <span class="mt-1 block text-sm text-muted-foreground">{{ s.description }}</span>
        </span>
      </button>
    </section>

    <!-- Pinned to the bottom of the page -->
    <section class="mt-auto flex flex-col gap-6 border-t pt-6 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs font-medium text-muted-foreground">Last 30 days</p>
        <dl class="mt-2 flex flex-wrap gap-x-8 gap-y-2">
          <div v-for="g in glance" :key="g.label" class="flex items-center gap-2">
            <span class="size-2 rounded-full" :class="g.dot" aria-hidden="true" />
            <dt class="text-sm text-muted-foreground">{{ g.label }}</dt>
            <dd class="text-sm font-semibold tabular-nums">{{ formatNumber(g.value) }}</dd>
          </div>
        </dl>
      </div>
      <nav aria-label="Shortcuts" class="flex flex-wrap gap-2">
        <template v-for="l in shortcuts" :key="l.title">
          <a
            v-if="l.href"
            :href="l.href"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <component :is="l.icon" class="size-3.5" aria-hidden="true" /> {{ l.title }} <ArrowUpRight class="size-3" aria-hidden="true" />
          </a>
          <button
            v-else
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="l.action"
          >
            <component :is="l.icon" class="size-3.5" aria-hidden="true" /> {{ l.title }}
          </button>
        </template>
      </nav>
    </section>
  </div>
</template>
