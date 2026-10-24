import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // assistant-ui's shared runtime imports React hook names. Per the
      // assistant-ui Vue docs, resolve them through the tap standalone shim
      // so the app runs without React installed.
      {
        find: /^react\/compiler-runtime$/,
        replacement: '@assistant-ui/tap/standalone-shim/compiler-runtime',
      },
      { find: /^react$/, replacement: '@assistant-ui/tap/standalone-shim' },
    ],
  },
  build: {
    rolldownOptions: {
      onwarn(warning, warn) {
        // assistant-ui's shared packages carry React "use client" directives,
        // which are meaningless in this Vue SPA.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
        warn(warning)
      },
    },
  },
})
