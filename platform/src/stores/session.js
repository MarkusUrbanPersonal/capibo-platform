import { computed, effectScope } from 'vue'
import { api } from '@convex/_generated/api'
import { useQuery } from '@/lib/convex'
import { auth } from '@/stores/auth'

/**
 * The signed-in user, their organization and permissions, kept live from
 * Convex for the lifetime of the app. `me` is undefined while loading and
 * null when signed out.
 */
const { data } = effectScope(true).run(() => useQuery(api.account.me, () => (auth.isAuthenticated ? {} : 'skip')))

export const me = computed(() => (auth.isAuthenticated ? data.value : null))
export const currentUser = computed(() => me.value?.user ?? null)
export const organization = computed(() => me.value?.organization ?? null)
export const can = computed(() => me.value?.can ?? {})
