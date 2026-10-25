import { invalid, missing } from './errors'

// Validators for untrusted JSON. Each returns the cleaned value, or undefined when
// the field is absent and optional, and throws a 400 naming the parameter otherwise.

export const isObject = (x) => typeof x === 'object' && x !== null && !Array.isArray(x)

export function str(x, param, { required = false, max = 500 } = {}) {
  if (x === undefined || x === null) {
    if (required) throw missing(param)
    return undefined
  }
  if (typeof x !== 'string') throw invalid(`${param} must be a string.`, param)
  const s = x.trim()
  if (required && !s) throw invalid(`${param} can't be empty.`, param)
  if (s.length > max) throw invalid(`${param} must be at most ${max} characters.`, param)
  return s
}

export function int(x, param, { required = false, min = -Infinity, max = Infinity } = {}) {
  if (x === undefined || x === null) {
    if (required) throw missing(param)
    return undefined
  }
  if (typeof x !== 'number' || !Number.isInteger(x)) throw invalid(`${param} must be an integer.`, param)
  if (x < min) throw invalid(`${param} must be at least ${min}.`, param)
  if (x > max) throw invalid(`${param} must be at most ${max}.`, param)
  return x
}

export function bool(x, param) {
  if (x === undefined || x === null) return undefined
  if (typeof x !== 'boolean') throw invalid(`${param} must be true or false.`, param)
  return x
}

export function oneOf(x, param, values, { required = false } = {}) {
  if (x === undefined || x === null) {
    if (required) throw missing(param)
    return undefined
  }
  if (!values.includes(x)) throw invalid(`${param} must be one of: ${values.join(', ')}.`, param)
  return x
}

export function strArray(x, param, { maxItems = 50, max = 200, values } = {}) {
  if (x === undefined || x === null) return undefined
  if (!Array.isArray(x)) throw invalid(`${param} must be an array.`, param)
  if (x.length > maxItems) throw invalid(`${param} can have at most ${maxItems} items.`, param)
  return x.map((item, i) => (values ? oneOf(item, `${param}[${i}]`, values, { required: true }) : str(item, `${param}[${i}]`, { required: true, max })))
}

/** An ISO 8601 date-time, returned as epoch milliseconds. */
export function dateTime(x, param) {
  if (x === undefined || x === null || x === '') return undefined
  const ms = typeof x === 'string' ? Date.parse(x) : NaN
  if (Number.isNaN(ms)) throw invalid(`${param} must be an ISO 8601 date-time, like 2026-10-24T09:41:07Z.`, param)
  return ms
}
