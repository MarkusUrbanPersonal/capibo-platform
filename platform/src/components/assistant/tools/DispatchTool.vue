<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Smartphone, CheckCircle2, Loader2, ArrowRight } from '@lucide/vue'
import StepList from '../StepList.vue'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

const props = defineProps({
  tool: { type: Object, required: true },
})

const router = useRouter()
const result = computed(() => props.tool.part.result)
const done = computed(() => result.value?.steps.filter((s) => s.status === 'done').length ?? 0)
const total = computed(() => result.value?.steps.length ?? 1)
const progress = computed(() => Math.round((done.value / total.value) * 100))
</script>

<template>
  <Card v-if="result" class="rise-in my-3 gap-0 overflow-hidden py-0 shadow-none">
    <CardHeader class="border-b bg-muted/40 px-4 py-3 !pb-3">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
            <Smartphone class="size-4" />
          </div>
          <div>
            <CardTitle class="text-sm">{{ result.done ? 'Published' : 'Publishing' }} {{ result.missionId }} to the Capibo app</CardTitle>
            <CardDescription class="text-xs">
              {{ result.done ? 'Open to collectors · no submissions yet' : 'Publishing tasks…' }}
            </CardDescription>
          </div>
        </div>
        <Badge v-if="result.done" class="gap-1 bg-emerald-500 text-white hover:bg-emerald-500">
          <CheckCircle2 class="size-3" /> Live
        </Badge>
        <Badge v-else variant="secondary" class="gap-1">
          <Loader2 class="size-3 animate-spin" /> Running
        </Badge>
      </div>
      <Progress :model-value="progress" class="mt-3 h-1.5 *:data-[slot=progress-indicator]:bg-emerald-500" aria-label="Dispatch progress" />
    </CardHeader>
    <CardContent class="px-4 py-3">
      <StepList :steps="result.steps" />
    </CardContent>
    <CardFooter v-if="result.done" class="justify-end gap-2 border-t px-4 py-3 !pt-3">
      <Button variant="outline" size="sm" @click="router.push({ name: 'missions-active' })">
        View active missions <ArrowRight class="size-4" />
      </Button>
    </CardFooter>
  </Card>
</template>
