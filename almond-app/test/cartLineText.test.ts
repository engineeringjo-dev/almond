import { describe, it, expect } from 'vitest';

import { customizationText } from '@/lib/cartLineText';

/**
 * L1 — THE LINE UNDER A CART ITEM SAYS EVERYTHING THAT WAS CHOSEN.
 *
 * The cart and the review cut it to one line («صغير · د…» at 320 px), at the
 * one step where a customer checks which milk they asked for (audit P2). Both
 * now render this text wrapped; this pins the text itself.
 */
const line = {
  sizeNameAr: 'وسط',
  sizeNameEn: 'Medium',
  customizations: [
    { groupId: 'milk', optionId: 'oat', nameAr: 'حليب شوفان', nameEn: 'Oat milk', priceDelta: 0.4 },
    { groupId: 'extra', optionId: 'shot', nameAr: 'شوت إضافي', nameEn: 'Extra shot', priceDelta: 0.5 },
    { groupId: 'extra', optionId: 'syrup', nameAr: 'فانيلا', nameEn: 'Vanilla', priceDelta: 0.3 },
  ],
};

describe('L1 customizationText', () => {
  it('lists the size and every option, in order, nothing dropped', () => {
    expect(customizationText(line, 'ar')).toBe('وسط · حليب شوفان، شوت إضافي، فانيلا');
    expect(customizationText(line, 'en')).toBe('Medium · Oat milk, Extra shot, Vanilla');
  });

  it('a line with no options is just its size; a blank name is skipped, not rendered as «، ،»', () => {
    expect(customizationText({ ...line, customizations: [] }, 'ar')).toBe('وسط');
    const blank = { ...line, customizations: [{ ...line.customizations[0], nameAr: ' ' }, line.customizations[1]] };
    expect(customizationText(blank, 'ar')).toBe('وسط · شوت إضافي');
    expect(customizationText({ ...line, sizeNameAr: '', customizations: [] }, 'ar')).toBe('');
  });
});

describe('L2 the cart and the review render it whole', () => {
  it('neither clamps the detail line (numberOfLines cut it to one)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    for (const rel of ['components/cart/CartLine.tsx', 'components/cart/ReviewSheet.tsx']) {
      const src = readFileSync(join(__dirname, '..', rel), 'utf8');
      const at = src.indexOf('{detail}');
      expect(at, `${rel} renders customizationText`).toBeGreaterThan(-1);
      // The <Text …> that opens the detail line.
      const open = src.lastIndexOf('<Text', at);
      expect(src.slice(open, at), rel).not.toMatch(/numberOfLines/);
    }
  });
});
