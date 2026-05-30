/**
 * Mock promo-code validation. Real codes/discounts live in Odoo (section 2.5);
 * this is a stand-in so the cart promo UI works end-to-end.
 * DECISION: two demo codes — flat and percentage.
 */
export interface PromoResult {
  valid: boolean;
  discount: number;
  code?: string;
}

export function validatePromo(rawCode: string, subtotal: number): PromoResult {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { valid: false, discount: 0 };
  switch (code) {
    case 'WELCOME':
      return { valid: true, discount: Math.min(1.0, subtotal), code };
    case 'ALMOND10':
      return { valid: true, discount: subtotal * 0.1, code };
    default:
      return { valid: false, discount: 0 };
  }
}
