/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ghost: {
          950: '#070A12', // deep night background
          900: '#0B0F19', // canvas background
          850: '#101626', // elevated surface
          800: '#161F36', // card background
          700: '#1E293B', // border subtle
          600: '#334155', // border muted
          500: '#64748B', // text secondary
          400: '#94A3B8', // text muted
          300: '#CBD5E1', // text body
          200: '#E2E8F0', // text bright
          100: '#F1F5F9', // white soft
        },
        accent: {
          cyan: '#06B6D4',
          blue: '#3B82F6',
          indigo: '#6366F1',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['System', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
