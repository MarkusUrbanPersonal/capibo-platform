import { httpRouter } from 'convex/server'
import { auth } from './auth'
import { handleCollector } from './lib/collectorRest'
import { handleV1 } from './lib/rest'

const http = httpRouter()

// Serves the JWKS and OpenID config Convex uses to verify session tokens.
auth.addHttpRoutes(http)

// The public REST API. lib/rest.js routes everything under /v1/ itself, and
// answers /v1 (no trailing slash) with a welcome message.
http.route({ path: '/v1', method: 'GET', handler: handleV1 })
for (const method of ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']) {
  http.route({ pathPrefix: '/v1/', method, handler: handleV1 })
}

// The collector app's API (lib/collectorRest.js), authenticated with COLLECTOR_API_SECRET.
for (const method of ['GET', 'POST']) {
  http.route({ pathPrefix: '/collector/v1/', method, handler: handleCollector })
}

export default http
