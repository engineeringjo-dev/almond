import type { Config } from 'tailwindcss';

/**
 * Brand tokens are owned by `@almond/shared/theme` (the single source of truth).
 * Colors + gradients here reference CSS variables that the root layout injects
 * from the shared theme at render time (see src/theme/cssVars.ts), so the
 * violet palette can never drift between the app and the website.
 * The numeric scales (spacing/radius/type) mirror the shared `spacing`,
 * `radius` and `fontSize` tokens.
 */
// Colours are `rgb(var(--color-x-rgb) / <alpha-value>)`, NOT `var(--color-x)`:
// Tailwind cannot apply an opacity modifier (`bg-error/10`) to a bare var() and
// silently generates no CSS for it. See src/theme/cssVars.ts#hexToChannels.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
        'primary-dark': 'rgb(var(--color-primary-dark-rgb) / <alpha-value>)',
        accent: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
        'accent-light': 'rgb(var(--color-accent-light-rgb) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary-rgb) / <alpha-value>)',
        'neutral-warm': 'rgb(var(--color-neutral-warm-rgb) / <alpha-value>)',
        background: 'rgb(var(--color-background-rgb) / <alpha-value>)',
        card: 'rgb(var(--color-card-rgb) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary-rgb) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary-rgb) / <alpha-value>)',
        success: 'rgb(var(--color-success-rgb) / <alpha-value>)',
        error: 'rgb(var(--color-error-rgb) / <alpha-value>)',
        'tier-bean': 'rgb(var(--color-tier-bean-rgb) / <alpha-value>)',
        'tier-silver': 'rgb(var(--color-tier-silver-rgb) / <alpha-value>)',
        'tier-gold': 'rgb(var(--color-tier-gold-rgb) / <alpha-value>)',
        'tier-black': 'rgb(var(--color-tier-black-rgb) / <alpha-value>)',
      },
      backgroundImage: {
        'gradient-rainbow': 'var(--gradient-rainbow)',
        'gradient-purple': 'var(--gradient-purple)',
        'gradient-dark': 'var(--gradient-dark)',
      },
      fontFamily: {
        sans: ['var(--font-hn-arabic)', 'system-ui', 'sans-serif'],
      },
      // Mirrors @almond/shared/theme `fontSize`.
      fontSize: {
        xs: '12px',
        sm: '14px',
        md: '16px',
        lg: '18px',
        xl: '22px',
        xxl: '28px',
        display: '36px',
      },
      // Mirrors @almond/shared/theme `spacing`.
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        xxl: '32px',
      },
      // Mirrors @almond/shared/theme `radius`.
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        pill: '999px',
      },
      // Mirrors @almond/shared/theme `shadow`.
      boxShadow: {
        card: '0 3px 10px rgba(46, 37, 82, 0.12)',
        raised: '0 6px 16px rgba(46, 37, 82, 0.20)',
      },
      transitionDuration: {
        base: '300ms',
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [],
};

export default config;
