/**
 * Demo promo codes (mock layer). Returns the JOD discount for a code, or 0 if
 * unknown. Under DATA_SOURCE='odoo' this would validate against the backend.
 */
const PROMOS: Record<string, number> = {
  ALMOND: 1.0,
  WELCOME: 1.5,
};

export function resolvePromo(code: string): number {
  return PROMOS[code.trim().toUpperCase()] ?? 0;
}
