<script setup>
import { computed } from 'vue'
import { toast } from '@/components/ui/toast'
import { Play, Copy, Download, Flag, CheckCircle2, XCircle, Clock } from '@lucide/vue'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { formatDateTime, formatDuration } from '@/lib/format'

const open = defineModel('open', { type: Boolean, default: false })
const props = defineProps({ video: { type: Object, default: null } })

const checks = computed(() => {
  const v = props.video
  if (!v || v.status === 'processing') return []
  return [
    { label: 'Hands in frame', pass: v.checks.handsInFrame, value: v.checks.handsInFrame ? 'Both hands tracked' : 'Lost for > 2s' },
    { label: 'Lighting', pass: v.checks.lighting >= 70, value: `${v.checks.lighting}/100` },
    { label: 'Motion blur', pass: v.checks.blur <= 20, value: `${v.checks.blur}% of frames` },
    { label: 'Task completed', pass: v.checks.taskComplete, value: v.checks.taskComplete ? 'End state detected' : 'End state missing' },
    { label: 'Privacy', pass: v.checks.privacy, value: v.checks.privacy ? 'No faces / screens' : 'Face detected' },
  ]
})

const metadata = computed(() => {
  const v = props.video
  if (!v) return []
  return [
    ['Mission', v.mission],
    ['Task', v.task],
    ['Collected', `${formatDateTime(v.createdAt)} UTC`],
    ['Duration', formatDuration(v.duration)],
    ['Resolution', `${v.resolution} · ${v.fps} fps`],
    ['File size', `${v.sizeMb} MB`],
    ['Device', v.device],
    ['Collector', v.collector],
    ['Region', v.region],
  ]
})

function copyId() {
  navigator.clipboard?.writeText(props.video.id).catch(() => {})
  toast.add({ title: 'Video ID copied' })
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-full gap-0 overflow-y-auto sm:max-w-md">
      <template v-if="video">
        <SheetHeader class="border-b">
          <div class="flex items-center gap-2">
            <SheetTitle class="font-mono text-base">{{ video.id }}</SheetTitle>
            <StatusBadge :status="video.status" />
          </div>
          <SheetDescription>{{ video.task }} · {{ video.mission }}</SheetDescription>
        </SheetHeader>

        <div class="flex flex-col gap-5 p-4">
          <!-- Preview placeholder (media streaming is not connected in the demo) -->
          <div class="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border bg-gradient-to-br from-muted to-muted/40">
            <div class="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_30%_40%,var(--border)_1px,transparent_1px)] [background-size:12px_12px]" aria-hidden="true" />
            <button type="button" class="relative flex size-12 items-center justify-center rounded-full bg-background/90 shadow-sm transition-transform hover:scale-105" aria-label="Play preview" @click="toast.add({ title: 'Preview streaming is not available in the demo' })">
              <Play class="ml-0.5 size-5" />
            </button>
            <span class="absolute right-2 bottom-2 rounded bg-background/90 px-1.5 py-0.5 font-mono text-[11px]">{{ formatDuration(video.duration) }}</span>
          </div>

          <section>
            <h3 class="mb-2 text-sm font-medium">Quality results</h3>
            <div v-if="video.status === 'processing'" class="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              <Clock class="size-4 text-status-warning" /> Quality review in progress — results usually arrive within 30 minutes.
            </div>
            <template v-else>
              <div class="mb-3 flex items-center gap-3">
                <span class="text-2xl font-semibold tabular-nums">{{ video.quality }}</span>
                <div class="flex-1">
                  <Progress :model-value="video.quality" class="h-1.5" aria-label="Quality score" />
                  <p class="mt-1 text-xs text-muted-foreground">Quality score · threshold 75</p>
                </div>
              </div>
              <p v-if="video.rejectionReason" class="mb-3 rounded-md border border-status-critical/30 bg-status-critical/5 px-3 py-2 text-sm">
                <span class="font-medium">Rejected:</span> {{ video.rejectionReason }}
              </p>
              <ul class="divide-y rounded-lg border">
                <li v-for="c in checks" :key="c.label" class="flex items-center gap-2 px-3 py-2 text-sm">
                  <CheckCircle2 v-if="c.pass" class="size-4 shrink-0 text-status-good" aria-label="Pass" />
                  <XCircle v-else class="size-4 shrink-0 text-status-critical" aria-label="Fail" />
                  <span class="flex-1">{{ c.label }}</span>
                  <span class="text-xs text-muted-foreground tabular-nums">{{ c.value }}</span>
                </li>
              </ul>
            </template>
          </section>

          <section>
            <h3 class="mb-2 text-sm font-medium">Labels</h3>
            <div class="flex flex-wrap gap-1.5">
              <Badge v-for="l in video.labels" :key="l" variant="secondary" class="font-normal">{{ l }}</Badge>
              <Badge variant="outline" class="font-normal">egocentric</Badge>
              <Badge variant="outline" class="font-normal">{{ video.fps }}fps</Badge>
            </div>
          </section>

          <Separator />

          <section>
            <h3 class="mb-2 text-sm font-medium">Metadata</h3>
            <dl class="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
              <template v-for="[k, v] in metadata" :key="k">
                <dt class="text-muted-foreground">{{ k }}</dt>
                <dd class="truncate">{{ v }}</dd>
              </template>
            </dl>
          </section>

          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" @click="copyId"><Copy class="size-4" /> Copy ID</Button>
            <Button size="sm" variant="outline" :disabled="video.status !== 'accepted'" @click="toast.add({ title: 'Download started', type: 'success', description: `${video.id}.mp4 + annotations.json` })">
              <Download class="size-4" /> Download
            </Button>
            <Button size="sm" variant="ghost" class="text-muted-foreground" @click="toast.add({ title: 'Flagged for manual review' })"><Flag class="size-4" /> Flag</Button>
          </div>
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>
