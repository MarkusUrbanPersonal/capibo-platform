<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { toast } from '@/components/ui/toast'
import { Download, CheckCircle2, Copy, Loader2, XCircle } from '@lucide/vue'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@convex/_generated/api'
import { convex, errorMessage, useQuery } from '@/lib/convex'
import { formatNumber } from '@/lib/format'

const open = defineModel('open', { type: Boolean, default: false })
const props = defineProps({
  datasetId: { type: String, required: true },
})

const FORMATS = [
  { value: 'lerobot', label: 'LeRobot (Hugging Face)' },
  { value: 'rlds', label: 'RLDS / TFRecord' },
  { value: 'webdataset', label: 'WebDataset (.tar shards)' },
  { value: 'mp4-json', label: 'MP4 + JSON annotations' },
]
// Storage integrations can't be connected yet, so only the download link works.
const DESTINATIONS = [
  { value: 'link', label: 'Download link' },
  { value: 's3', label: 'Amazon S3 · not connected', disabled: true },
  { value: 'gcs', label: 'Google Cloud Storage · not connected', disabled: true },
  { value: 'hf', label: 'Hugging Face · not connected', disabled: true },
]

const { data: datasets } = useQuery(api.datasets.list, () => (open.value ? {} : 'skip'))
const form = reactive({ datasetId: '', format: 'lerobot', destination: 'link', includeRejected: false })
const jobId = ref(null)
const submitting = ref(false)
const { data: job } = useQuery(api.exports.get, () => (jobId.value ? { id: jobId.value } : 'skip'))

watch(open, (v) => {
  if (!v) return
  jobId.value = null
  form.datasetId = props.datasetId
})

const selected = computed(() => datasets.value?.find((d) => d.id === form.datasetId))
const phase = computed(() => {
  if (!jobId.value) return 'form'
  if (!job.value || job.value.status === 'queued' || job.value.status === 'packaging') return 'running'
  return job.value.status // ready | failed
})

watch(phase, (p) => {
  if (p === 'ready') toast.add({ title: 'Dataset export ready', type: 'success', description: `${formatNumber(job.value.videos)} videos · ${job.value.id}` })
})

async function start() {
  submitting.value = true
  try {
    jobId.value = await convex.mutation(api.exports.create, { ...form })
  } catch (e) {
    toast.add({ title: errorMessage(e), type: 'error' })
  } finally {
    submitting.value = false
  }
}

function copyLink() {
  navigator.clipboard?.writeText(job.value.url).catch(() => {})
  toast.add({ title: 'Link copied' })
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Export dataset</DialogTitle>
        <DialogDescription>Package video metadata, quality results and file links into a JSON manifest.</DialogDescription>
      </DialogHeader>

      <form v-if="phase === 'form'" id="export-form" class="grid gap-4" @submit.prevent="start">
        <div class="grid gap-2">
          <Label>Dataset</Label>
          <Select v-model="form.datasetId">
            <SelectTrigger class="w-full"><SelectValue placeholder="Loading datasets…" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="d in datasets ?? []" :key="d.id" :value="d.id">
                {{ d.missionName }} · {{ formatNumber(d.videos) }}
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
                <SelectItem v-for="d in DESTINATIONS" :key="d.value" :value="d.value" :disabled="d.disabled">{{ d.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div class="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <Label for="exp-rej">Include rejected videos</Label>
            <p class="text-xs text-muted-foreground">Useful for training quality classifiers.</p>
          </div>
          <Switch id="exp-rej" v-model="form.includeRejected" />
        </div>
      </form>

      <div v-else-if="phase === 'running'" class="flex items-center gap-2 py-2 text-sm" role="status" aria-live="polite">
        <Loader2 class="size-4 animate-spin" /> {{ job?.status === 'packaging' ? 'Packaging videos…' : 'Queued…' }}
      </div>

      <div v-else-if="phase === 'ready'" class="grid gap-3 py-2">
        <div class="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 class="size-5 text-status-good" /> Export ready
        </div>
        <div class="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
          <a :href="job.url" target="_blank" rel="noopener" class="flex-1 truncate font-mono text-xs underline-offset-4 hover:underline">{{ job.url }}</a>
          <Button variant="ghost" size="icon" class="size-7" aria-label="Copy link" @click="copyLink"><Copy class="size-3.5" /></Button>
        </div>
        <p class="text-xs text-muted-foreground">Job <span class="font-mono">{{ job.id }}</span> · {{ formatNumber(job.videos) }} videos</p>
      </div>

      <div v-else class="flex items-center gap-2 py-2 text-sm" role="alert">
        <XCircle class="size-5 text-status-critical" /> {{ job.error }}
      </div>

      <DialogFooter>
        <template v-if="phase === 'form'">
          <Button variant="outline" @click="open = false">Cancel</Button>
          <Button type="submit" form="export-form" :disabled="!selected?.videos || submitting">
            <Download class="size-4" /> Export {{ formatNumber(selected?.videos) }} videos
          </Button>
        </template>
        <Button v-else :disabled="phase === 'running'" @click="open = false">Done</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
