import { ref } from 'vue'

const isDark = ref(typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))

export function useTheme() {
  function set(dark) {
    isDark.value = dark
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('capibo-theme', dark ? 'dark' : 'light')
    } catch {
      // storage unavailable (private mode); theme still applies for this session
    }
  }
  return { isDark, set, toggle: () => set(!isDark.value) }
}
