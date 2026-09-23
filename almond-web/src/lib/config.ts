import { config as sharedConfig } from '@almond/shared/config';

export type DataSource = 'mock' | 'odoo';

/**
 * Website data-source switch (mirrors the app). Defaults to the shared default
 * ('mock') so the site is fully demoable; flip per deploy via
 * NEXT_PUBLIC_DATA_SOURCE=odoo to go live — nothing else changes.
 */
const rawSource: string = process.env.NEXT_PUBLIC_DATA_SOURCE ?? sharedConfig.DATA_SOURCE;

// VALIDATED, NOT CAST. Every consumer tests `=== 'odoo'`, so a typo ('Odoo',
// 'live', or an empty value, which `??` does not catch) used to run every MOCK
// path — payForOrder() reported the order paid with no gateway — while isMock
// said false. A deploy with a bad value must fail at boot, not take money it
// never collected.
if (rawSource !== 'mock' && rawSource !== 'odoo') {
  throw new Error(
    `NEXT_PUBLIC_DATA_SOURCE must be 'mock' or 'odoo', got ${JSON.stringify(rawSource)}`,
  );
}

export const DATA_SOURCE: DataSource = rawSource;

export const isMock = DATA_SOURCE === 'mock';

/** Shared loyalty / pricing constants (POINTS_PER_JOD, TAX_RATE, …). */
export const config = sharedConfig;
