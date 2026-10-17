// Run before the renderer bundle and first paint. Keep the page usable when
// storage is unavailable, and validate stored values before applying them.
(() => {
  let preference = 'system'
  try {
    const saved = localStorage.getItem('ghost.appearance')
    if (saved === 'light' || saved === 'dark' || saved === 'system') preference = saved
  } catch { /* A restricted storage context still follows the system. */ }
  const theme = preference === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preference
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.themePreference = preference
  document.documentElement.style.colorScheme = theme
})()
