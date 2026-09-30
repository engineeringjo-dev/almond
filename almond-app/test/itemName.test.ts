import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { secondaryName } from '@/lib/itemName';

/**
 * N1-N2 — NO NAME PRINTED TWICE (audit P2): «Cortado / Cortado» when Odoo has
 * no Arabic translation.
 */

describe('N1 the second line only when it adds something', () => {
  it('a translated item shows the other language', () => {
    expect(secondaryName({ nameAr: 'لاتيه مثلج', nameEn: 'Iced Latte' }, 'ar')).toBe('Iced Latte');
    expect(secondaryName({ nameAr: 'لاتيه مثلج', nameEn: 'Iced Latte' }, 'en')).toBe('لاتيه مثلج');
  });

  it('an untranslated item shows nothing under its name', () => {
    expect(secondaryName({ nameAr: 'Cortado', nameEn: 'Cortado' }, 'ar')).toBeNull();
    expect(secondaryName({ nameAr: 'Iced Americano Cold Foam', nameEn: 'Iced americano  cold-foam' }, 'en')).toBeNull();
  });

  it('an empty translation shows nothing', () => {
    expect(secondaryName({ nameAr: 'كورتادو', nameEn: '' }, 'ar')).toBeNull();
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
