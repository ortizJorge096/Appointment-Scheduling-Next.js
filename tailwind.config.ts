import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#B8932A',
          light:   '#D4AD5A',
          pale:    '#F5EDDA',
          dark:    '#8A6E1E',
        },
        beige: {
          DEFAULT: '#F2EBD9',
          dark:    '#E8DCC4',
          deeper:  '#D9CCAF',
        },
        ink: {
          DEFAULT: '#111111',
          soft:    '#1E1E1E',
          mid:     '#4A4035',
          muted:   '#7A7060',
        },
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans:  ['DM Sans', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease forwards',
        'fade-in': 'fadeIn 0.4s ease forwards',
      },
    },
  },
  plugins: [],
}
export default config
