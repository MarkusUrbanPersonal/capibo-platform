import { reactive } from 'vue'
import { ConvexHttpClient } from 'convex/browser'
import { ConvexError } from 'convex/values'
import { api } from '@convex/_generated/api'
import { CONVEX_URL, convex, errorMessage } from '@/lib/convex'

/**
 * Convex Auth for Vue. A port of the token handling in @convex-dev/auth/react
 * (same storage keys, so sessions are interchangeable): the JWT and refresh
 * token live in localStorage, and the Convex client asks for a fresh JWT
 * through the refresh token when the server rejects the current one.
 */
const ns = CONVEX_URL.replace(/[^a-zA-Z0-9]/g, '')
const JWT_KEY = `__convexAuthJWT_${ns}`
const REFRESH_KEY = `__convexAuthRefreshToken_${ns}`

const storage = {
  get: (k) => {
    try { return localStorage.getItem(k) } catch { return null }
  },
  set: (k, v) => {
    try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* private mode */ }
  },
}

export const auth = reactive({ isLoading: true, isAuthenticated: false })

let token = storage.get(JWT_KEY)
let readyResolvers = []

function settle(isAuthenticated) {
  auth.isAuthenticated = isAuthenticated
  auth.isLoading = false
  readyResolvers.forEach((r) => r(isAuthenticated))
  readyResolvers = []
}

/** Resolves once the server has confirmed (or rejected) the stored session. */
export function authReady() {
  return auth.isLoading ? new Promise((r) => readyResolvers.push(r)) : Promise.resolve(auth.isAuthenticated)
}

function storeTokens(tokens) {
  token = tokens?.token ?? null
  storage.set(JWT_KEY, token)
  storage.set(REFRESH_KEY, tokens?.refreshToken ?? null)
}

// Auth calls run without the (possibly expired) JWT, as in the React client.
const unauthenticated = () => new ConvexHttpClient(CONVEX_URL)

async function refreshAccessToken() {
  const before = token
  const run = async () => {
    // Another tab refreshed while we waited for the lock.
    if (token !== before) return token
    const refreshToken = storage.get(REFRESH_KEY)
    if (!refreshToken) return null
    try {
      const { tokens } = await unauthenticated().action(api.auth.signIn, { refreshToken })
      storeTokens(tokens ?? null)
    } catch {
      return null
    }
    return token
  }
  return navigator.locks ? navigator.locks.request(REFRESH_KEY, run) : run()
}

async function fetchAccessToken({ forceRefreshToken }) {
  return forceRefreshToken ? refreshAccessToken() : token
}

function attach() {
  convex.setAuth(fetchAccessToken, (ok) => settle(ok))
}

// Boot: confirm a stored session with the server, or start signed out.
if (token) attach()
else settle(false)

// Sign-in or sign-out in another tab.
window.addEventListener('storage', (e) => {
  if (e.key !== JWT_KEY) return
  token = e.newValue
  if (token && !auth.isAuthenticated) attach()
  if (!token && auth.isAuthenticated) {
    convex.client.clearAuth()
    settle(false)
  }
})

const PASSWORD_ERRORS = [
  [/InvalidSecret|InvalidAccountId|Invalid credentials/i, 'Incorrect email or password'],
  [/already exists/i, 'An account with this email already exists. Log in instead.'],
  [/TooManyFailedAttempts/i, 'Too many attempts. Wait a few minutes and try again.'],
]

// Production deployments redact plain errors to "Server Error". Convex Auth throws plain errors
// for wrong credentials and taken emails (our own validation uses ConvexError, which isn't
// redacted), so a redacted error is most likely one of those.
const REDACTED_ERRORS = {
  signIn: 'Incorrect email or password',
  signUp: 'An account with this email already exists. Log in instead.',
}

function authErrorMessage(e, flow) {
  const text = String(e?.message ?? '')
  for (const [re, message] of PASSWORD_ERRORS) if (re.test(text)) return message
  if (!(e instanceof ConvexError) && /Server Error/.test(text) && REDACTED_ERRORS[flow]) return REDACTED_ERRORS[flow]
  return errorMessage(e)
}

/**
 * Email + password sign-in. `flow` is 'signIn' or 'signUp'; sign-up also takes
 * `name` and `company`. Throws an Error with a message fit to show the person.
 */
export async function signInWithPassword(flow, params) {
  let result
  try {
    result = await unauthenticated().action(api.auth.signIn, {
      provider: 'password',
      params: { ...params, flow },
    })
  } catch (e) {
    throw new Error(authErrorMessage(e, flow))
  }
  if (!result.tokens) throw new Error('Sign-in did not complete. Please try again.')
  storeTokens(result.tokens)
  auth.isLoading = true
  attach()
  if (!(await authReady())) throw new Error('Your session could not be verified. Please try again.')
}

export async function signOut() {
  try {
    await convex.action(api.auth.signOut, {})
  } catch {
    // Usually means the session already ended.
  }
  storeTokens(null)
  convex.client.clearAuth()
  settle(false)
}
