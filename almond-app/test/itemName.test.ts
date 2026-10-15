import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { secondaryName } from '@/lib/itemName';

/**
 * N1-N3 — ONE NAME, READ WHOLE: no name printed twice (audit P2, «Cortado /
 * Cortado» when Odoo has no Arabic translation), no English line in an Arabic
 * menu, and room on the tile for a long name (expert panel, 2026-10-15).
 */

describe('N1 the second line only when it adds something', () => {
  it('an Arabic menu is read in Arabic: no English line under the name', () => {
    // Expert panel, 2026-10-15: «لاتيه مثلج» over «Iced Latte» on every tile.
    expect(secondaryName({ nameAr: 'لاتيه مثلج', nameEn: 'Iced Latte' }, 'ar')).toBeNull();
  });

  it('in English a translated item shows its Arabic name, as the counter says it', () => {
    expect(secondaryName({ nameAr: 'لاتيه مثلج', nameEn: 'Iced Latte' }, 'en')).toBe('لاتيه مثلج');
  });

  it('an untranslated item shows nothing under its name', () => {
    expect(secondaryName({ nameAr: 'Iced Americano Cold Foam', nameEn: 'Iced americano  cold-foam' }, 'en')).toBeNull();
  });

  it('an empty translation shows nothing', () => {
    expect(secondaryName({ nameAr: '  ', nameEn: 'Cortado' }, 'en')).toBeNull();
  });
});

describe('N2 the tile and the item sheet use it', () => {
  const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');
  it('MenuItemCard and ItemModal print the second line through secondaryName', () => {
    for (const f of ['components/menu/MenuItemCard.tsx', 'components/menu/ItemModal.tsx']) {
      expect(src(f), f).toMatch(/secondaryName\(item, lang\)/);
      expect(src(f), f).not.toMatch(/lang === 'ar' \? item\.nameEn : item\.nameAr/);
    }
  });

  it('the tile\'s "from" price is a locale key, not a typed «من »', () => {
    const s = src('components/menu/MenuItemCard.tsx');
    expect(s).toMatch(/t\('menu\.fromPrice'/);
    expect(s).not.toMatch(/'من '|'from '/);
  });
});

describe('N3 a long name gets two lines on the tile', () => {
  it('the tile\'s name wraps to two lines before it is cut', () => {
    // «بايغل مع أومليت وجبنة شيدر» was cut to «بايغل مع أومل…» on one line.
    const s = readFileSync(join(__dirname, '..', 'components/menu/MenuItemCard.tsx'), 'utf8');
    expect(s).toMatch(/<Text variant="bodyBold" numberOfLines=\{2\}[^>]*>\s*\{lang === 'ar' \? item\.nameAr : item\.nameEn\}/);
  });
});
