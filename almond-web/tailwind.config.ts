import type { Config } from 'tailwindcss';

/**
 * Brand tokens are owned by `@almond/shared/theme` (the single source of truth).
 * Colors + gradients here reference CSS variables that the root layout injects
 * from the shared theme at render time (see src/theme/cssVars.ts), so the
 * violet palette can never drift between the app and the website.
 * The numeric scales (spacing/radius/type) mirror the shared `spacing`,
 * `radius` and `fontSize` tokens.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-dark': 'var(--color-primary-dark)',
        accent: 'var(--color-accent)',
        'accent-light': 'var(--color-accent-light)',
        secondary: 'var(--color-secondary)',
        'neutral-warm': 'var(--color-neutral-warm)',
        background: 'var(--color-background)',
        card: 'var(--color-card)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        success: 'var(--color-success)',
        error: 'var(--color-error)',
        'tier-bean': 'var(--color-tier-bean)',
        'tier-silver': 'var(--color-tier-silver)',
        'tier-gold': 'var(--color-tier-gold)',
        'tier-black': 'var(--color-tier-black)',
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
