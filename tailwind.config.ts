import type { Config } from 'tailwindcss';
import { iconsPlugin, getIconCollections } from '@egoist/tailwindcss-icons';

export default {
  darkMode: 'class',
  content: ['./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx,mdx,md}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Commit Mono"', 'monospace'],
      },
      colors: {
        text: {
          strong: 'var(--text-strong)',
          'strong-hover': 'var(--text-strong-hover)',
          weak: 'var(--text-weak)',
          'weak-hover': 'var(--text-weak-hover)',
          invert: 'var(--text-invert)',
          'invert-hover': 'var(--text-invert-hover)',
          disabled: 'var(--text-disabled)',
        },
        icon: {
          strong: {
            base: 'var(--icon-strong-base)',
            hover: 'var(--icon-strong-hover)',
          },
          weak: {
            base: 'var(--icon-weak-base)',
            hover: 'var(--icon-weak-hover)',
          },
          invert: {
            base: 'var(--icon-invert-base)',
            hover: 'var(--icon-invert-hover)',
          },
        },
        surface: {
          raised: {
            base: 'var(--surface-raised-base)',
            'base-hover': 'var(--surface-raised-base-hover)',
          },
          flat: {
            base: 'var(--surface-flat-base)',
            'base-hover': 'var(--surface-flat-base-hover)',
          },
          invert: {
            base: 'var(--surface-invert-base)',
            'base-hover': 'var(--surface-invert-base-hover)',
          },
          disabled: 'var(--surface-disabled)',
        },
        button: {
          primary: {
            base: 'var(--button-primary-base)',
            hover: 'var(--button-primary-hover)',
            active: 'var(--button-primary-active)',
            disabled: 'var(--button-primary-disabled)',
          },
          secondary: {
            base: 'var(--button-secondary-base)',
            hover: 'var(--button-secondary-hover)',
            active: 'var(--button-secondary-active)',
            disabled: 'var(--button-secondary-disabled)',
          },
          ghost: {
            base: 'var(--button-ghost-base)',
            hover: 'var(--button-ghost-hover)',
            active: 'var(--button-ghost-active)',
            disabled: 'var(--button-ghost-disabled)',
          },
        },
        border: {
          strong: 'var(--border-strong)',
          weak: 'var(--border-weak)',
          invert: 'var(--border-invert)',
        },
        shadow: {
          raised: 'var(--shadow-raised)',
          flat: 'var(--shadow-flat)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    iconsPlugin({
      collections: getIconCollections(['simple-icons', 'simple-line-icons']),
    }),
    require('tailwindcss-animate'),
  ],
} satisfies Config;
