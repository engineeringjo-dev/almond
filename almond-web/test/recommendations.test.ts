import { describe, expect, it } from 'vitest';
import { getItemPairings, getCartCrossSell, getComboUpsell } from '@almond/shared/lib/recommendations';
import { itemInsights } from '@almond/shared/menu/menu.insights.generated';
import { menuItems } from '@almond/shared/menu/seed';
import type { CartItem, MenuItem } from '@almond/shared/types';

/**
 * Suggestions lead with what customers ACTUALLY buy together (measured from
 * Odoo POS orders — scripts/odoo-menu-insights.ts), and only fall back to the
 * rule-based picks when an item has no measured pair (GM, 2026-09-25).
 */

const byName = (n: string) => menuItems.find((m) => m.nameEn.trim() === n)!;
const cartOf = (m: MenuItem): CartItem => ({
  lineId: m.id, itemId: m.id, nameAr: m.nameAr, nameEn: m.nameEn, emoji: '',
  sizeId: m.sizes[0]!.id, sizeNameAr: '', sizeNameEn: '', unitBasePrice: m.sizes[0]!.price, customizations: [], qty: 1,
});
const onMenu = new Set(menuItems.map((m) => m.id));

describe('measured suggestions', () => {
  it('an item page leads with its measured partners, in measured order', () => {
    const bagel = byName('Halloumi And Pesto Bagel');
    const measured = itemInsights[bagel.id]!.crossSell.map((c) => c.itemId).filter((id) => onMenu.has(id));
    expect(measured.length).toBeGreaterThan(0);
    const shown = getItemPairings(bagel, 4).map((m) => m.id);
    expect(shown.slice(0, measured.length)).toEqual(measured.slice(0, 4));
    expect(shown).not.toContain(bagel.id);
  });

  it('an item with no measured pair still gets rule-based suggestions', () => {
    const lonely = menuItems.find((m) => !itemInsights[m.id]?.crossSell.length)!;
    expect(getItemPairings(lonely, 4).length).toBeGreaterThan(0);
  });

  it('the cart suggests the measured partner and never what is already in it', () => {
    const bagel = byName('Halloumi And Pesto Bagel');
    const first = itemInsights[bagel.id]!.crossSell.find((c) => onMenu.has(c.itemId))!.itemId;
    const suggestions = getCartCrossSell([cartOf(bagel)], 8).map((m) => m.id);
    expect(suggestions[0]).toBe(first);
    expect(suggestions).not.toContain(bagel.id);
  });

  it('the combo nudge offers the measured drink for a food-only cart', () => {
    const bagel = byName('Halloumi And Pesto Bagel');
    const up = getComboUpsell([cartOf(bagel)])!;
    expect(up.missing).toBe('drink');
    expect(itemInsights[bagel.id]!.crossSell.map((c) => c.itemId)).toContain(up.item.id);
  });
});
