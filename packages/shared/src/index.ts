/**
 * @almond/shared — the single source of truth shared by the mobile app
 * (`almond-app/`, React Native + Expo) and the website (`almond-web/`, Next.js).
 *
 * These modules — domain types, brand theme tokens, the real menu, loyalty
 * constants, category classification and JOD formatting — are the contract
 * between app and web. Keep them identical by construction (one import), never
 * by copy/paste. See docs/WEBSITE-HANDOFF.md §10.
 */
export * from './types';
export * from './theme';
export * from './config';
export * from './integration';
export * from './loyalty';
export * from './menu';
export * from './lib/categoryKind';
export * from './lib/format';
