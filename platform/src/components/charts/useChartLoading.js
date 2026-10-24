import { onBeforeUnmount, ref, watch } from 'vue'

/**
 * Simulated fetch for charts: `loading` is true briefly on mount and whenever
 * `source` changes, so the chart shows a skeleton instead of animating in.
 */
export function useChartLoading(source, ms = 450) {
  const loading = ref(true)
  let timer
  const start = () => {
    loading.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (loading.value = false), ms)
  }
  start()
  watch(source, start)
  onBeforeUnmount(() => clearTimeout(timer))
  return loading
}
