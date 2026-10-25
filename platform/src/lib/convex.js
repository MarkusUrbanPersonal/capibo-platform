import { ConvexClient } from 'convex/browser'
import { ConvexError } from 'convex/values'
import { computed, getCurrentScope, onScopeDispose, shallowRef, toValue, watch } from 'vue'

export const CONVEX_URL = import.meta.env.VITE_CONVEX_URL
if (!CONVEX_URL) throw new Error('VITE_CONVEX_URL is not set. Run `npx convex dev` in platform/ to create .env.local.')

export const convex = new ConvexClient(CONVEX_URL)

/**
 * Live Convex query as Vue refs. `args` may be an object, a ref or a getter;
 * return 'skip' from it to pause the subscription.
 */
export function useQuery(fn, args = {}) {
  const data = shallowRef(undefined)
  const error = shallowRef(null)
  let unsubscribe = null

  const stop = watch(
    () => {
      const a = toValue(args)
      return a === 'skip' ? 'skip' : JSON.stringify(a)
    },
    (key) => {
      unsubscribe?.()
      unsubscribe = null
      // Never show a result for other args (or a previous user) while the new one loads.
      data.value = undefined
      error.value = null
      if (key === 'skip') return
      unsubscribe = convex.onUpdate(
        fn,
        JSON.parse(key),
        (result) => {
          data.value = result
          error.value = null
        },
        (e) => (error.value = e),
      )
    },
    { immediate: true },
  )

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stop()
      unsubscribe?.()
    })
  }

  return { data, error, isLoading: computed(() => data.value === undefined && !error.value) }
}

/** The message to show a person for an error thrown by a Convex function. */
export function errorMessage(e, fallback = 'Something went wrong. Please try again.') {
  if (e instanceof ConvexError) return typeof e.data === 'string' ? e.data : e.data?.message ?? fallback
  return fallback
}
