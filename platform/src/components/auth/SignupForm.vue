<script setup>
// shadcn signup-05 form. Design only: submit is a no-op until the auth backend lands.
import { cn } from 'cn'
import AuthBrand from '@/components/auth/AuthBrand.vue'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const props = defineProps({
  class: { type: [Boolean, null, String, Object, Array], required: false, skipCheck: true },
})
</script>

<template>
  <div :class="cn('flex flex-col gap-6', props.class)">
    <form @submit.prevent>
      <FieldGroup>
        <AuthBrand title="Create your account">
          Already have an account?
          <RouterLink to="/login">Sign in</RouterLink>
        </AuthBrand>
        <Field>
          <FieldLabel for="email">Email</FieldLabel>
          <Input id="email" type="email" placeholder="email@example.com" autocomplete="email" required />
        </Field>
        <Field>
          <Button type="submit">Create Account</Button>
        </Field>
      </FieldGroup>
    </form>
    <FieldDescription class="px-6 text-center">
      By clicking continue, you agree to our <a href="#">Terms of Service</a>
      and <a href="#">Privacy Policy</a>.
    </FieldDescription>
  </div>
</template>
