import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { layout } from '@almond/shared/theme';

/**
 * W1-W2 — WIDE WINDOWS AND THE ORPHAN /menu (audit P2).
 *
 * W1: the journey screens stopped nowhere on a tablet or desktop (2 columns of
 * ~700 px cards, a 1,400 px CTA). W2: `/menu` was a second copy of the Order
 * menu with no cart entry. The browser checks are in e2e/app/design-system.spec.ts.
 */

const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('W1 a readable, centred column on a wide window', () => {
  it('a phone-to-small-tablet width, from the shared theme', () => {
    expect(layout.contentMaxWidth).toBeGreaterThanOrEqual(480);
    expect(layout.contentMaxWidth).toBeLessThanOrEqual(768);
  });

  it('the Order tab caps and centres itself', () => {
    const s = src('app/(tabs)/order.tsx');
    const safe = s.slice(s.indexOf('  safe: {'), s.indexOf('},', s.indexOf('  safe: {')));
    expect(safe).toMatch(/maxWidth: layout\.contentMaxWidth/);
    expect(safe).toMatch(/alignSelf: 'center'/);
  });

  it('the cart screen is capped through the root stack', () => {
    const s = src('app/_layout.tsx');
    expect(s).toMatch(/JOURNEY_SCREENS = new Set\(\['cart'\]\)/);
    expect(s).toMatch(/maxWidth: layout\.contentMaxWidth/);
  });
});

describe('W2 /menu is the Order tab', () => {
  it('the route only redirects — no second menu to drift', () => {
    const s = src('app/(tabs)/menu.tsx');
    expect(s).toMatch(/<Redirect href="\/\(tabs\)\/order" \/>/);
    expect(s).not.toMatch(/FlatList|CategoryChips|MenuItemCard/);
  });
});
