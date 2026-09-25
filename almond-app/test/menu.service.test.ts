import { describe, it, expect, vi } from 'vitest';

/**
 * The app's menu is the shop's Odoo POS menu in EVERY mode (GM, 2026-09-25:
 * «عدلت التطبيق حسب الموديفايرز والمنيو عنا؟»). Live mode used to switch to a
 * stub that called Odoo from the phone and would have shown raw products.
 */
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));

describe('menuService', () => {
  it('in LIVE mode serves the same Odoo menu, with add-ons, and calls nobody', async () => {
    vi.resetModules();
    const { config } = await import('@/constants/config');
    const previous = config.DATA_SOURCE;
    (config as { DATA_SOURCE: string }).DATA_SOURCE = 'odoo';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const { menuService } = await import('@/services/menu.service');
      const { menuItems } = await import('@almond/shared/menu');
      const items = await menuService.getItems('all');
      expect(items).toHaveLength(menuItems.length);
      const latte = items.find((i) => i.nameEn === 'Iced Latte')!;
      expect(latte.customizations.find((g) => g.id === 'g-addons')?.nameAr).toBe('إضافات');
      expect(latte.sizes.every((z) => z.price > 0)).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      (config as { DATA_SOURCE: string }).DATA_SOURCE = previous;
      fetchSpy.mockRestore();
    }
  });

  it('never serves an item switched off on the POS (Chinese Chicken Sandwich)', async () => {
    const { menuService } = await import('@/services/menu.service');
    const all = await menuService.getItems('all');
    expect(all.some((i) => i.nameEn.trim() === 'Chinese Chicken Sandwich')).toBe(false);
    expect(all.some((i) => i.nameEn.trim() === 'Mini Chinese Chicken Sandwich')).toBe(true);
  });
});
