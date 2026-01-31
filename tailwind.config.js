/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Commit Mono"', 'monospace'],
      },
      colors: {
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverted: 'var(--text-inverted)',
        },
        icon: {
          primary: 'var(--icon-primary)',
          secondary: 'var(--icon-secondary)',
          inverted: 'var(--icon-inverted)',
        },
        surface: {
          white: 'var(--surface-white)',
          'gray-50': 'var(--surface-gray-50)',
          'gray-100': 'var(--surface-gray-100)',
          charcoal: 'var(--surface-charcoal)',
        },
        border: {
          default: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      transitionDuration: {
        fast: 'var(--transition-fast)',
        base: 'var(--transition-base)',
        slow: 'var(--transition-slow)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
