import { config as sharedConfig } from '@almond/shared/config';

export type DataSource = 'mock' | 'odoo';

/**
 * Website data-source switch (mirrors the app). Defaults to the shared default
 * ('mock') so the site is fully demoable; flip per deploy via
 * NEXT_PUBLIC_DATA_SOURCE=odoo to go live — nothing else changes.
 */
export const DATA_SOURCE: DataSource =
  (process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource | undefined) ??
  (sharedConfig.DATA_SOURCE as DataSource);

export const isMock = DATA_SOURCE === 'mock';

/** Shared loyalty / pricing constants (POINTS_PER_JOD, TAX_RATE, …). */
export const config = sharedConfig;
