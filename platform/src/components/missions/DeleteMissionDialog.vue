<script setup>
import { useRouter } from 'vue-router'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deleteMission } from '@/stores/missions'
import { errorMessage } from '@/lib/convex'

const props = defineProps({
  mission: { type: Object, default: null },
  // Where to go once deleted; navigating first keeps a detail page from flashing "not found".
  redirect: { type: [String, Object], default: null },
})
const open = defineModel('open', { type: Boolean, default: false })
const router = useRouter()

async function confirm() {
  const { id, name } = props.mission
  open.value = false
  try {
    if (props.redirect) await router.push(props.redirect)
    await deleteMission(id)
  } catch (e) {
    return toast.add({ title: errorMessage(e), type: 'error' })
  }
  toast.add({ title: `${name} deleted`, type: 'success' })
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent v-if="mission" class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Delete {{ mission.name }}?</DialogTitle>
        <DialogDescription>
          Collectors stop receiving its tasks and the mission is removed from your workspace. Videos already accepted stay in your datasets.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="open = false">Cancel</Button>
        <Button variant="destructive" @click="confirm">Delete mission</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
