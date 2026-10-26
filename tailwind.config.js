/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        jarvis: {
          base: 'var(--jarvis-base)',
          dark: 'var(--jarvis-base)',
          surface: 'var(--jarvis-surface)',
          elevated: 'var(--jarvis-elevated)',
          hover: 'var(--jarvis-hover)',
          border: 'var(--jarvis-border)',
          borderStrong: 'var(--jarvis-border-strong)',
          accent: 'var(--jarvis-accent)',
          accentHover: 'var(--jarvis-accent-hover)',
          accentGlow: 'var(--jarvis-accent-glow)',
          ivory: 'var(--jarvis-ivory)',
          sage: 'var(--jarvis-sage)',
          muted: 'var(--jarvis-muted)',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#3b82f6'
        }
      }
    }
  },
  plugins: []
}
