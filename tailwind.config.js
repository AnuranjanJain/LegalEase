/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Safelist dynamically-constructed classes for runtime severity indicators
  safelist: [
  {
    pattern:
      /(bg|text|border)-(red|green|blue|yellow|gray|purple|indigo)-(100|200|300|400|500|600|700)/,
  },
],
  // Dark mode via 'class' strategy — toggle by adding/removing 'dark' on <html>
  darkMode: 'class',
  theme: {
    // Centered container with responsive padding and custom 2xl breakpoint (1400px)
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
        xl: '2.5rem',
        '2xl': '3rem',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1400px',
      },
    },
    extend: {
      // Semantic color tokens — use these instead of raw Tailwind colors
      // for consistent theming across light/dark modes
      colors: {
        // Primary brand color — buttons, links, key interactive elements
        primary: {
          DEFAULT: '#2563EB',
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          650: '#2159e2',
          700: '#1d4ed8',
          750: '#1d47c4',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Positive states — confirmations, successful operations
        success: {
          DEFAULT: '#16A34A',
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        // Caution states — pending actions, attention-required
        warning: {
          DEFAULT: '#CA8A04',
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
          950: '#422006',
        },
        // Error states — destructive actions, critical alerts
        error: {
          DEFAULT: '#DC2626',
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        // Informational states — tips, neutral alerts
        info: {
          DEFAULT: '#0EA5E9',
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        // Page backgrounds for light/dark themes
        background: {
          light: '#F3F4F6',
          dark: '#111827',
        },
        // Intermediate gray shades interpolated between Tailwind's defaults.
        // These were used throughout the UI (e.g. gray-150 borders, gray-850
        // dark cards) but don't exist in the default palette, so Tailwind
        // emitted no CSS and elements silently kept the wrong color — the
        // root cause of the light/dark theme inconsistencies (issue #330).
        // Merged with the default gray scale via theme.extend.
        gray: {
          55: '#f6f7f9',   // between 50 and 100
          150: '#ecedf0',  // between 100 and 200
          250: '#dbdee3',  // between 200 and 300
          350: '#b7bcc5',  // between 300 and 400
          450: '#848b97',  // between 400 and 500
          455: '#848b97',  // alias of 450 (typo'd in source)
          550: '#5b636c',  // between 500 and 600
          650: '#414b5a',  // between 600 and 700
          750: '#2b3544',  // between 700 and 800
          850: '#18202f',  // between 800 and 900
        },
        // Intermediate shades for the other palettes used in the app
        red: { 650: '#cb2121', 750: '#a91c1c' },
        amber: { 650: '#c76508' },
        blue: { 650: '#2159e2' },
        indigo: { 650: '#493fd7' },
        emerald: { 550: '#0aa875' },
      },
      // Display font for headings and hero text
      fontFamily: {
        display: ['Inter', 'sans-serif'],
      },
      // Custom animations — see docs/tailwind-theme-guide.md
      animation: {
        'slide-up': 'slideUp 0.2s ease-out',  // Toast notifications, modals
        'spin-slow': 'spin 3s linear infinite', // Decorative loading spinners
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
