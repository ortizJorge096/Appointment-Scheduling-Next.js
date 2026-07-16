import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Gold is semantic by surface + text size, so contrast never breaks:
        //   DEFAULT → dark surfaces (6.3:1 on ink) or purely decorative
        //   dark    → LARGE text on light (4.1:1 on beige → AA large)
        //   deep    → SMALL text + links on light (5.0:1 beige / 5.9:1 white → AA)
        gold: {
          DEFAULT: '#B8932A',
          light:   '#D4AD5A',
          pale:    '#F5EDDA',
          dark:    '#8A6E1E',
          deep:    '#7A611A',
        },
        beige: {
          DEFAULT: '#F2EBD9',
          dark:    '#E8DCC4',
          deeper:  '#D9CCAF',
        },
        // muted clears AA on white (4.9:1) but not on beige (4.1:1), so beige
        // surfaces take muted-deep instead (4.8:1 beige / 5.7:1 white).
        ink: {
          DEFAULT:      '#1A1209',
          soft:         '#2A2014',
          mid:          '#4A4035',
          muted:        '#7A7060',
          'muted-deep': '#6E6656',
        },
        // Warm light grays for muted text ON dark surfaces (cards on ink, navbar
        // over the hero) — ink-muted is too dark to read there. Named on the
        // cream family since that is what they read as against ink.
        cream: {
          DEFAULT: '#CFC6B4', // navbar links, section labels on ink
          muted:   '#B7AE9C', // secondary copy on ink cards
        },
      },
      fontFamily: {
        serif:  ['Cormorant Garamond', 'Georgia', 'serif'],
        sans:   ['DM Sans', 'system-ui', 'sans-serif'],
        script: ['Great Vibes', 'Cormorant Garamond', 'cursive'],
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
