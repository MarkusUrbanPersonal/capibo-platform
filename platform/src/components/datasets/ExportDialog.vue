<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { toast } from '@/components/ui/toast'
import { Download, CheckCircle2, Copy, Loader2 } from '@lucide/vue'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { datasets, missionById } from '@/data/mock'
import { formatNumber } from '@/lib/format'

const open = defineModel('open', { type: Boolean, default: false })
const props = defineProps({
  // Accepted videos matching the page's filters; null hides the "Current filter" option.
  filteredCount: { type: Number, default: null },
  missionId: { type: String, default: 'all' },
})

const FORMATS = [
  { value: 'lerobot', label: 'LeRobot (Hugging Face)' },
  { value: 'rlds', label: 'RLDS / TFRecord' },
  { value: 'webdataset', label: 'WebDataset (.tar shards)' },
  { value: 'mp4-json', label: 'MP4 + JSON annotations' },
]
const DESTINATIONS = [
  { value: 's3', label: 's3://timefactories/datasets' },
  { value: 'hf', label: 'Hugging Face · timefactories (private)' },
  { value: 'link', label: 'Signed download link (24h)' },
]

const form = reactive({ scope: 'filtered', format: 'lerobot', destination: 's3', includeRejected: false, blur: true })
const phase = ref('form') // form | running | done
const progress = ref(0)
const jobId = ref('')

watch(open, (v) => {
  if (v) {
    phase.value = 'form'
    progress.value = 0
    if (props.missionId !== 'all') form.scope = `ds:${props.missionId}`
    else form.scope = props.filteredCount !== null ? 'filtered' : `ds:${datasets[0].missionId}`
  }
})

const scopeCount = computed(() => {
  if (form.scope === 'filtered') return props.filteredCount
  const ds = datasets.find((d) => `ds:${d.missionId}` === form.scope)
  return ds?.videos ?? 0
})

function start() {
  phase.value = 'running'
  jobId.value = `exp_${Math.random().toString(36).slice(2, 10)}`
  const timer = setInterval(() => {
    progress.value = Math.min(100, progress.value + 7 + Math.random() * 12)
    if (progress.value >= 100) {
      clearInterval(timer)
      phase.value = 'done'
      toast.add({ title: 'Dataset export complete', type: 'success', description: `${formatNumber(scopeCount.value)} videos → ${DESTINATIONS.find((d) => d.value === form.destination).label}` })
    }
  }, 280)
}

const destinationLabel = computed(() => DESTINATIONS.find((d) => d.value === form.destination)?.label)
const resultPath = computed(() =>
  form.destination === 'link'
    ? `https://exports.capibo.work/${jobId.value}.tar?sig=••••••`
    : form.destination === 'hf'
      ? `hf://datasets/timefactories/${jobId.value}`
      : `s3://timefactories/datasets/${jobId.value}/`,
)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Export dataset</DialogTitle>
        <DialogDescription>Package accepted videos with labels and quality metadata for training.</DialogDescription>
      </DialogHeader>

      <form v-if="phase === 'form'" id="export-form" class="grid gap-4" @submit.prevent="start">
        <div class="grid gap-2">
          <Label>Videos</Label>
          <Select v-model="form.scope">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-if="filteredCount !== null" value="filtered">Current filter · {{ formatNumber(filteredCount) }} videos</SelectItem>
              <SelectItem v-for="d in datasets" :key="d.id" :value="`ds:${d.missionId}`">
                {{ missionById[d.missionId].name }} · {{ formatNumber(d.videos) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-2">
            <Label>Format</Label>
            <Select v-model="form.format">
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="f in FORMATS" :key="f.value" :value="f.value">{{ f.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label>Destination</Label>
            <Select v-model="form.destination">
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="d in DESTINATIONS" :key="d.value" :value="d.value">{{ d.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div class="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <Label for="exp-blur">Apply privacy blurring</Label>
            <p class="text-xs text-muted-foreground">Blur faces and screens in exported frames.</p>
          </div>
          <Switch id="exp-blur" v-model="form.blur" />
        </div>
        <div class="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <Label for="exp-rej">Include rejected videos</Label>
            <p class="text-xs text-muted-foreground">Useful for training quality classifiers.</p>
          </div>
          <Switch id="exp-rej" v-model="form.includeRejected" />
        </div>
      </form>

      <div v-else-if="phase === 'running'" class="grid gap-3 py-2" role="status" aria-live="polite">
        <div class="flex items-center gap-2 text-sm">
          <Loader2 class="size-4 animate-spin" /> Packaging {{ formatNumber(scopeCount) }} videos…
          <span class="ml-auto tabular-nums text-muted-foreground">{{ Math.floor(progress) }}%</span>
        </div>
        <Progress :model-value="progress" class="h-2" aria-label="Export progress" />
        <p class="text-xs text-muted-foreground">
          {{ progress < 35 ? 'Collecting videos and annotations' : progress < 75 ? 'Writing shards and manifest' : 'Uploading to ' + destinationLabel }}
        </p>
      </div>

      <div v-else class="grid gap-3 py-2">
        <div class="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 class="size-5 text-status-good" /> Export ready
        </div>
        <div class="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
          <code class="flex-1 truncate font-mono text-xs">{{ resultPath }}</code>
          <Button variant="ghost" size="icon" class="size-7" aria-label="Copy path" @click="toast.add({ title: 'Path copied' })"><Copy class="size-3.5" /></Button>
        </div>
        <p class="text-xs text-muted-foreground">Job <span class="font-mono">{{ jobId }}</span> · {{ formatNumber(scopeCount) }} videos · manifest.json included</p>
      </div>

      <DialogFooter>
        <template v-if="phase === 'form'">
          <Button variant="outline" @click="open = false">Cancel</Button>
          <Button type="submit" form="export-form" :disabled="scopeCount === 0"><Download class="size-4" /> Export {{ formatNumber(scopeCount) }} videos</Button>
        </template>
        <Button v-else :disabled="phase === 'running'" @click="open = false">Done</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
