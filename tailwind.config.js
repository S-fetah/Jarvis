/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        jarvis: {
          base: '#0a1114',
          dark: '#0a1114',
          surface: '#111f1e',
          elevated: '#172c29',
          hover: '#1e3834',
          border: '#1f3832',
          borderStrong: '#2b5049',
          accent: '#3ba172',
          accentHover: '#46b883',
          accentGlow: '#52c48e',
          ivory: '#f5f1ee',
          sage: '#d1d7d0',
          muted: '#8a9992',
          success: '#3ba172',
          warning: '#eab308',
          danger: '#ef4444',
          info: '#2dd4bf'
        }
      }
    }
  },
  plugins: []
}
