/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        jarvis: {
          dark: '#0d1117',
          surface: '#161b22',
          border: '#30363d',
          accent: '#58a6ff',
          success: '#2ea043',
          warning: '#d29922',
          danger: '#f85149'
        }
      }
    }
  },
  plugins: []
}
