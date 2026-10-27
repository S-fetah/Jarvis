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
          raised: 'var(--jarvis-raised)',
          sunken: 'var(--jarvis-sunken)',
          hover: 'var(--jarvis-hover)',
          border: 'var(--jarvis-border)',
          borderStrong: 'var(--jarvis-border-strong)',
          accent: 'var(--jarvis-accent)',
          accentHover: 'var(--jarvis-accent-hover)',
          accentGlow: 'var(--jarvis-accent-glow)',
          accentSoft: 'var(--jarvis-accent-soft)',
          accentContrast: 'var(--jarvis-accent-contrast)',
          ivory: 'var(--jarvis-ivory)',
          sage: 'var(--jarvis-sage)',
          muted: 'var(--jarvis-muted)',
          signal: 'var(--jarvis-signal)',
          signalSoft: 'var(--jarvis-signal-soft)',
          signalContrast: 'var(--jarvis-signal-contrast)',
          success: 'var(--jarvis-success)',
          warning: 'var(--jarvis-signal)',
          danger: 'var(--jarvis-danger)',
          dangerSoft: 'var(--jarvis-danger-soft)',
          dangerContrast: 'var(--jarvis-danger-contrast)',
          info: 'var(--jarvis-info)',
          code: 'var(--jarvis-code-bg)',
          codeInk: 'var(--jarvis-code-ink)'
        }
      },
      fontFamily: {
        sans: [
          'Instrument Sans Variable',
          'Segoe UI Variable',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
        display: ['Fraunces Variable', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['JetBrains Mono Variable', 'Cascadia Code', 'Consolas', 'monospace']
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '9px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '26px'
      },
      boxShadow: {
        hairline: 'var(--jarvis-shadow-1)',
        raised: 'var(--jarvis-shadow-2)',
        floating: 'var(--jarvis-shadow-3)',
        signal: '0 0 0 1px color-mix(in srgb, var(--jarvis-signal) 32%, transparent)'
      },
      fontSize: {
        '2xs': ['10.5px', { lineHeight: '1.35', letterSpacing: '0.055em' }],
        '3xs': ['9.5px', { lineHeight: '1.3', letterSpacing: '0.08em' }]
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(10px)' },
          to: { opacity: '1', transform: 'translateX(0)' }
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.985)' },
          to: { opacity: '1', transform: 'scale(1)' }
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(0.82)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
        'slide-up': 'slide-up 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'scale-in': 'scale-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
