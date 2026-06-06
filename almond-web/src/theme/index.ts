/**
 * Re-export the shared brand tokens so website TS code reads the same theme the
 * app uses (single source of truth). Tailwind classes are wired to these via
 * CSS variables — see ./cssVars.ts and tailwind.config.ts.
 */
export * from '@almond/shared/theme';
export { themeVars } from './cssVars';
