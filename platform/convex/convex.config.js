import { defineApp } from 'convex/server'
import rateLimiter from '@convex-dev/rate-limiter/convex.config.js'

const app = defineApp()
// Per-key request limits for the public REST API (see lib/rest.js).
app.use(rateLimiter)

export default app
