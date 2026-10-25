import { ConvexError } from 'convex/values'

const TYPES = {
  400: 'invalid_request',
  401: 'authentication_error',
  402: 'payment_required',
  403: 'permission_denied',
  404: 'not_found',
  409: 'conflict',
  429: 'rate_limited',
}

/**
 * An error in the API's documented shape (docs/api-reference/errors.mdx).
 * The REST layer turns it into the HTTP response; the platform shows `message`.
 */
export function apiError(status, code, message, param) {
  const data = { status, type: TYPES[status] ?? 'api_error', code, message }
  if (param) data.param = param
  return new ConvexError(data)
}

export const invalid = (message, param) => apiError(400, 'parameter_invalid', message, param)
export const missing = (param) => apiError(400, 'parameter_missing', `${param} is required.`, param)
export const notFound = (what, ref) => apiError(404, 'resource_missing', `No ${what} with id ${ref}.`)
