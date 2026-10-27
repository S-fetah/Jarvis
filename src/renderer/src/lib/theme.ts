import type { ThemePreference } from '../../../shared/types'

const THEME_KEY = 'jarvis-theme'

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Applies a theme preference to the document and caches it so the pre-paint
 * bootstrap can avoid a flash on the next launch.
 */
export function applyTheme(preference: ThemePreference): 'light' | 'dark' {
  const effective = resolveTheme(preference)
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(effective)
  root.style.colorScheme = effective
  try {
    localStorage.setItem(THEME_KEY, preference)
  } catch {
    // Local storage can be unavailable in hardened environments.
  }
  void window.jarvisAPI?.setWindowTheme?.(preference)
  return effective
}

export function cacheTheme(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_KEY, preference)
  } catch {
    // Ignore storage failures.
  }
}

export function readCachedTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Ignore storage failures.
  }
  return 'system'
}

export function onSystemThemeChange(callback: () => void): () => void {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
