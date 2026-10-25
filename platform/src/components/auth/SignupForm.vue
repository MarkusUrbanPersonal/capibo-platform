<script setup>
// shadcn signup-05 form. Creates the account with Convex Auth's Password provider;
// the server then creates the organization (or joins a pending invite for this email).
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
const form = reactive({ name: '', company: '', email: '', password: '' })
const error = ref('')
const submitting = ref(false)

async function submit() {
  error.value = ''
  if (form.password.length < 8) return (error.value = 'Password must be at least 8 characters')
  submitting.value = true
  try {
    await signInWithPassword('signUp', { ...form })
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
        <AuthBrand title="Create your account">
          Already have an account?
          <RouterLink :to="{ name: 'login', query: route.query }">Sign in</RouterLink>
        </AuthBrand>
        <Field>
          <FieldLabel for="name">Your name</FieldLabel>
          <Input id="name" v-model="form.name" placeholder="Ada Lovelace" autocomplete="name" required />
        </Field>
        <Field>
          <FieldLabel for="company">Company</FieldLabel>
          <Input id="company" v-model="form.company" placeholder="Acme Robotics" autocomplete="organization" />
          <FieldDescription>Joining a teammate? Use the email they invited and you'll land in their organization.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel for="email">Email</FieldLabel>
          <Input id="email" v-model="form.email" type="email" placeholder="email@example.com" autocomplete="email" required />
        </Field>
        <Field>
          <FieldLabel for="password">Password</FieldLabel>
          <Input id="password" v-model="form.password" type="password" autocomplete="new-password" minlength="8" required />
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <Field>
          <Button type="submit" :disabled="submitting">
            <LoaderCircle v-if="submitting" class="size-4 animate-spin" aria-hidden="true" />
            Create Account
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
