// Apply the saved theme before first paint to avoid a flash.
// Kept as a static file so Vite serves it untouched.
try {
  var t = localStorage.getItem('capibo-theme')
  if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
} catch (e) {}
