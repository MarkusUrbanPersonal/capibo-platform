<script setup>
// shadcn login-05 form, signing in with Convex Auth's Password provider.
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { cn } from 'cn'
import { LoaderCircle } from '@lucide/vue'
import AuthBrand from '@/components/auth/AuthBrand.vue'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { signInWithPassword } from '@/stores/auth'
import { safeRedirect } from '@/router'

const props = defineProps({
  class: { type: [Boolean, null, String, Object, Array], required: false, skipCheck: true },
})

const route = useRoute()
const router = useRouter()
const form = reactive({ email: '', password: '' })
const error = ref('')
const submitting = ref(false)

async function submit() {
  error.value = ''
  submitting.value = true
  try {
    await signInWithPassword('signIn', { email: form.email, password: form.password })
    await router.replace(safeRedirect(route.query.redirect))
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div :class="cn('flex flex-col gap-6', props.class)">
    <form @submit.prevent="submit">
      <FieldGroup>
        <AuthBrand title="Welcome back!">
          Don't have an account?
          <RouterLink :to="{ name: 'signup', query: route.query }">Sign up</RouterLink>
        </AuthBrand>
        <Field>
          <FieldLabel for="email">Email</FieldLabel>
          <Input id="email" v-model="form.email" type="email" placeholder="email@example.com" autocomplete="email" required />
        </Field>
        <Field>
          <FieldLabel for="password">Password</FieldLabel>
          <Input id="password" v-model="form.password" type="password" autocomplete="current-password" required />
        </Field>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <Field>
          <Button type="submit" :disabled="submitting">
            <LoaderCircle v-if="submitting" class="size-4 animate-spin" aria-hidden="true" />
            Login
          </Button>
        </Field>
      </FieldGroup>
    </form>
    <FieldDescription class="px-6 text-center">
      By clicking continue, you agree to our <a href="https://capibo.work/terms" target="_blank" rel="noopener">Terms of Service</a>
      and <a href="https://capibo.work/privacy" target="_blank" rel="noopener">Privacy Policy</a>.
    </FieldDescription>
  </div>
</template>
