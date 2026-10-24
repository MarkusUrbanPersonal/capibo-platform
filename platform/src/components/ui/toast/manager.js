import { createToastManager } from 'reka-ui'

/**
 * Global toast manager, usable from anywhere (components, stores, services).
 * Mirrors shadcn/ui's Toast API: `toast.add({ title, description, type, actionProps })`,
 * `toast.close(id)`, `toast.update(id, …)` and `toast.promise(p, { loading, success, error })`.
 * `type` picks the icon: 'success' | 'error' | 'warning' | 'info' | 'loading'.
 */
const manager = createToastManager()

// shadcn's `type` is the status; reka's `type` is announcement priority, so map one onto the other.
function toOptions({ type, ...options }) {
  return type ? { ...options, status: type } : options
}

export const toast = {
  ...manager,
  add: (options) => manager.add(toOptions(options)),
  update: (id, updates) => manager.update(id, typeof updates === 'function' ? (prev) => toOptions(updates(prev)) : toOptions(updates)),
}

export { manager as toastManager }
