/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cittaa: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
        },
        clinical: {
          blue: '#0ea5e9',
          'blue-light': '#06b6d4',
          'blue-dark': '#0284c7',
        },
        status: {
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#3b82f6',
        },
        severity: {
          minimal: '#22c55e',
          mild: '#84cc16',
          moderate: '#f59e0b',
          severe: '#ef4444',
        },
      },
      backgroundColor: {
        'app-bg': '#F8F7FF',
        'app-text': '#1E1B2E',
      },
      textColor: {
        'app': '#1E1B2E',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'spin-slow': 'spin 3s linear infinite',
        'gauge-fill': 'gaugeFill 1.5s ease-out forwards',
      },
      keyframes: {
        gaugeFill: {
          '0%': { strokeDashoffset: '565' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      fontSize: {
        '2xs': '0.6875rem',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}
