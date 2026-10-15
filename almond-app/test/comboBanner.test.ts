import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeEarn } from '@almond/shared/loyalty/earn';
import { SHIPPED_DOUBLE_POINTS_DAYS } from '@almond/shared/config';
import { cartLineFor, computeTotals } from '@almond/shared/cart';
import { menuItems } from '@almond/shared/menu/seed';
import { itemKind } from '@almond/shared/lib/categoryKind';
import type { CartItem, MenuItem } from '@almond/shared/types';
import { comboGain, estimateEarnedPoints, ESTIMATE_RULES, type PointsFor } from '@/lib/earnEstimate';
import { comboBasket } from '@/lib/combo';
import { getComboUpsell } from '@/lib/recommendations';

/**
 * THE CART'S COMBO BANNER STATES WHAT THE ORDER EARNS (Dunkin' panel,
 * 2026-10-15). It said «واكسب 50 نقطة» whatever adding the item did, and the
 * 50 REPLACES the pair's own points: a 6% member paying from the balance on a
 * double-points day was told to add a 1.90 JOD brioche to a latte that earned
 * 63 on its own, and earn 50.
 */
const LATTE = menuItems.find((m) => m.nameAr === 'لاتيه الموند ساخن')!;
const BRIOCHE = menuItems.find((m) => m.nameAr === 'قطعة بريوش التفاح')!;
const line = (m: MenuItem): CartItem => cartLineFor(m, m.sizes[0]!, [], 1);
const XMAS = new Date('2026-12-25T12:00:00+03:00'); // a shipped double-points day

/** The cart's estimate, on a given day: the shipped calendar instead of the empty test one. */
const onDay = (at: Date, member: { windowSpend: number; paidFromBalance: boolean }): PointsFor => (lines) => {
  const total = computeTotals(lines, 0).total;
  return computeEarn(
    { total, windowSpend: member.windowSpend, paidFromBalance: member.paidFromBalance, combo: comboBasket(lines, total), at },
    { ...ESTIMATE_RULES, doubleDays: SHIPPED_DOUBLE_POINTS_DAYS },
  ).points;
};

describe('CB the combo banner', () => {
  it('fixtures: a 3.50 drink and a 1.90 food the cart offers with it', () => {
    expect(LATTE.sizes[0]!.price).toBe(3.5);
    expect(itemKind(LATTE.id)).toBe('drink');
    expect(BRIOCHE.sizes[0]!.price).toBe(1.9);
    expect(itemKind(BRIOCHE.id)).toBe('food');
  });

  it('CB1 a 2% member: the order earns 50 with the food instead of 7, and the banner says those numbers', () => {
    const pointsFor: PointsFor = (lines) =>
      estimateEarnedPoints({ total: computeTotals(lines, 0).total, items: lines, windowSpend: 0, paidFromBalance: false });
    expect(comboGain(pointsFor, [line(LATTE)], BRIOCHE)).toEqual({ before: 7, after: 50 });
    // The offer the banner makes is a real one: the cart does propose a food.
    expect(getComboUpsell([line(LATTE)])?.missing).toBe('food');
  });

  it('CB2 a 6% member paying from the balance on a double-points day: 63 alone, 50 with it — no banner', () => {
    const top = onDay(XMAS, { windowSpend: 65, paidFromBalance: true });
    expect(top([line(LATTE)])).toBe(63);
    expect(top([line(LATTE), line(BRIOCHE)])).toBe(50);
    expect(comboGain(top, [line(LATTE)], BRIOCHE)).toBeNull();
    // The same member on an ordinary day gains, and is shown it.
    const plain = onDay(new Date('2026-12-20T12:00:00+03:00'), { windowSpend: 65, paidFromBalance: true });
    expect(comboGain(plain, [line(LATTE)], BRIOCHE)).toEqual({ before: 32, after: 50 });
  });

  it('CB3 the banner reads its numbers from comboGain, never from the dial', () => {
    const src = readFileSync(join(__dirname, '..', 'components', 'cart', 'CrossSellRow.tsx'), 'utf8');
    expect(src).toContain('comboGain(pointsFor, items, offer.item)');
    expect(src).not.toContain('COMBO_BONUS_POINTS');
    // …and it is hidden, not merely relabelled, when there is no gain.
    expect(src).toMatch(/const upsell = offer && gain \? \{ \.\.\.offer, \.\.\.gain \} : null;/);
    const cart = readFileSync(join(__dirname, '..', 'app', 'cart.tsx'), 'utf8');
    expect(cart).toContain('<CrossSellRow items={items} pointsFor={pointsFor} />');
    expect(cart).toContain('const pointsToEarn = useMemo(() => pointsFor(items), [pointsFor, items]);');
  });
});
