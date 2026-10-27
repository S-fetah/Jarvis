;(function () {
  try {
    var stored = localStorage.getItem('jarvis-theme')
    var preference = stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system'
    var dark =
      preference === 'dark' ||
      (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.classList.toggle('light', !dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  } catch (_) {
    document.documentElement.classList.add('light')
  }
})()
