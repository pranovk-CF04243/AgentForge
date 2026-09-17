/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        enterprise: {
          bg: '#0c0e14',        // Deep neutral dark
          sidebar: '#11141d',   // Secondary surface
          card: '#161a26',      // Card surface
          cardHover: '#1c2233', // Card hover surface
          border: '#23293b',    // Refined subtle border
          borderLight: '#2f374e',
          text: '#f1f5f9',      // Off-white primary text
          muted: '#94a3b8',     // Slate secondary text
          dim: '#64748b',       // Tertiary text
          blue: '#2563eb',      // Enterprise primary blue
          blueLight: '#3b82f6',
          indigo: '#4f46e5',
          emerald: '#059669',   // Success green
          amber: '#d97706',     // Warning amber
          rose: '#e11d48',      // Critical rose
        },
        cyber: {
          950: '#06080e',
          900: '#0c0f18',
          850: '#111522',
          800: '#171c2d',
          700: '#232a42',
          600: '#333e61',
          accent: '#06b6d4',
          accentLight: '#22d3ee',
        }
      }
    },
  },
  plugins: [],
}
