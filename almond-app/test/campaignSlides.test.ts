import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInstance } from 'i18next';
import { categories as menuCategories, menuItems } from '@almond/shared/menu';
import { computeEarn, earnRulesFromConfig, walletExtraPercentage } from '@almond/shared/loyalty/earn';
import { campaignAccessibleLabel, campaignCollection, campaignSlides, logicalSlide, physicalSlide } from '@/lib/campaignSlides';
import { createScrollSettlement } from '@/lib/scrollSettlement';

const APP = join(__dirname, '..');
const source = (path: string) => readFileSync(join(APP, path), 'utf8');
const locales = (lang: 'ar' | 'en') => JSON.parse(source(`locales/${lang}.json`));

describe('The Home campaign pager is manual, directional and actionable', () => {
  it('keeps the requested order and contact-only custom products', () => {
    const slides = campaignSlides(50, 50, true);
    expect(slides.map((slide) => slide.id)).toEqual(['combo', 'gift-card', 'wallet', 'catering', 'gift-box', 'design-cakes', 'keto-gluten-free']);
    expect(slides.map((slide) => slide.href)).toEqual(['/campaigns', '/profile/gift-cards', '/profile/wallet', '/profile/help', '/profile/help', '/profile/help', '/(tabs)/order']);
    expect(slides.at(-1)?.params).toEqual({ tab: 'menu', collection: 'keto-gluten-free' });
    for (const slide of slides) {
      expect(slide).not.toHaveProperty('price');
      expect(slide).not.toHaveProperty('itemId');
    }
  });

  it('does not lose discovery when combo retires, nor advertise an absent collection or uplift', () => {
    for (const points of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(campaignSlides(points, 50, true).map((slide) => slide.id)).not.toContain('combo');
      expect(campaignSlides(points, 50, true)[0].id).toBe('gift-card');
    }
    expect(campaignSlides(50, 0, false).map((slide) => slide.id)).not.toContain('keto-gluten-free');
    expect(campaignSlides(50, 0, true).find((slide) => slide.id === 'wallet')?.titleKey).toBe('walletPlainTitle');
  });

  it('Arabic finger-right advances from combo to gift; English finger-left does the same', () => {
    for (const width of [288, 358, 380, 648]) {
      const arFirst = physicalSlide(0, 7, true) * width;
      expect(logicalSlide(arFirst - width, width, 7, true)).toBe(1);
      expect(logicalSlide(width, width, 7, false)).toBe(1);
      for (let index = 0; index < 7; index++) {
        for (const rtl of [true, false]) expect(logicalSlide(physicalSlide(index, 7, rtl) * width, width, 7, rtl)).toBe(index);
      }
    }
    expect(logicalSlide(-99, 300, 7, false)).toBe(0);
    expect(logicalSlide(9000, 300, 7, false)).toBe(6);
  });

  it('uses native paging, hides inactive content and does not render inactive actions', () => {
    const pager = source('components/home/CampaignPager.tsx');
    expect(pager).toContain('<ScrollView');
    expect(pager).toContain('pagingEnabled');
    expect(pager).toContain('directionalLockEnabled');
    expect(pager).toContain('aria-hidden={!active}');
    expect(pager).toContain("importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}");
    expect(pager).toContain('minWidth: MIN_TOUCH_TARGET');
    expect(pager).not.toMatch(/setInterval|setTimeout|PanResponder|Animated\./);
    expect(pager).toContain("onScroll={Platform.OS === 'web' ? (event) => webSettlement.update(event.nativeEvent.contentOffset.x) : undefined}");
    expect(pager).toContain('onMomentumScrollEnd={settle}');
    expect(source('components/home/CampaignSlideCard.tsx')).toContain('if (!active) return <View');
    expect(source('components/home/PromoCarousel.tsx')).toContain("slides[index].id === 'combo' && active");
    expect(source('app/(tabs)/index.tsx')).not.toContain('<CateringEntry');
  });

  it('uses intact real art with no hidden cart mutation', () => {
    const manifestPath = join(APP, 'components/home/campaignSlidePhotos.ts');
    const manifest = readFileSync(manifestPath, 'utf8');
    for (const [, path] of manifest.matchAll(/require\('([^']+)'\)/g)) expect(existsSync(resolve(dirname(manifestPath), path)), path).toBe(true);
    const card = source('components/home/CampaignSlideCard.tsx');
    expect(card).toContain('resizeMode="contain"');
    expect(card).not.toMatch(/useCartStore|addItem\(|\.price\b/);
  });
});

describe('Web scroll settlement commits only after actual scroll events pause', () => {
  it('the newest rapid-button destination wins over stale intermediate scroll events, until a user gesture takes over', () => {
    vi.useFakeTimers();
    try {
      const committed: [number, boolean][] = [];
      const settlement = createScrollSettlement((offset, requested) => committed.push([offset, requested]));
      // Arabic: three Next intents from physical page6 to page3. Browser
      // observations lag one request behind, including its final idle event.
      settlement.request(1500);
      settlement.update(1800);
      vi.advanceTimersByTime(80);
      settlement.request(1200);
      settlement.update(1500);
      vi.advanceTimersByTime(80);
      settlement.request(900);
      settlement.update(1200);
      vi.advanceTimersByTime(140);
      expect(committed).toEqual([[900, true]]);
      expect(logicalSlide(committed[0][0], 300, 7, true)).toBe(3);
      // Touch/wheel begins: user movement supersedes any queued button target.
      settlement.request(600);
      settlement.update(900);
      settlement.cancel();
      settlement.update(1500);
      vi.advanceTimersByTime(140);
      expect(committed).toEqual([[900, true], [1500, false]]);
      const pager = source('components/home/CampaignPager.tsx');
      expect(pager).toContain('indexRef.current + delta');
      expect(pager).toContain("animated: Platform.OS !== 'web' && !reduced");
      expect(pager).toContain('onTouchStart={Platform.OS');
      expect(pager).toContain('onWheel: webSettlement.cancel');
    } finally {
      vi.useRealTimers();
    }
  });

  it('commits the latest offset once, with no per-tick update or automatic advance', () => {
    vi.useFakeTimers();
    try {
      const committed: number[] = [];
      const settlement = createScrollSettlement((offset) => committed.push(logicalSlide(offset, 300, 7, true)));
      vi.advanceTimersByTime(1000);
      expect(committed).toEqual([]);
      settlement.update(1800);
      vi.advanceTimersByTime(100);
      settlement.update(1680);
      vi.advanceTimersByTime(100);
      settlement.update(1500);
      vi.advanceTimersByTime(139);
      expect(committed).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(committed).toEqual([1]);
      vi.advanceTimersByTime(1000);
      expect(committed).toEqual([1]);
      settlement.update(1200);
      settlement.cancel();
      vi.advanceTimersByTime(1000);
      expect(committed).toEqual([1]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Collection handoff uses current category metadata', () => {
  it('selects only current keto/GF categories and actual items', () => {
    const found = campaignCollection('keto-gluten-free', menuCategories, menuItems)!;
    expect(found.items.length).toBeGreaterThan(0);
    expect(found.categories.map((category) => category.id)).toEqual(['cat-4', 'cat-12', 'cat-43']);
    expect(found.items.some((item) => item.id === 'p-10278')).toBe(true);
    expect(found.items.every((item) => found.categories.some((category) => category.id === item.categoryId))).toBe(true);
    expect(found.items.every((item) => menuItems.includes(item))).toBe(true);
    for (const input of [undefined, 'cat-14', 'anything', ['keto-gluten-free']]) expect(campaignCollection(input, menuCategories, menuItems)).toBeNull();
    expect(campaignCollection('keto-gluten-free', [], menuItems)).toBeNull();
    expect(campaignCollection('keto-gluten-free', menuCategories, [])).toBeNull();
  });

  it('has a real receiver, a way back to all products, and one-shot invalid-reorder recovery', () => {
    const order = source('app/(tabs)/order.tsx');
    expect(order).toContain('campaignCollection(params.collection, categoriesQuery.data ?? [], items)');
    expect(order).toContain('items={collection?.items ?? items}');
    expect(order).toContain('router.setParams({ collection: undefined })');
    expect(order).toContain("params.tab === 'menu'");
    expect(order).toContain('router.setParams({ tab: undefined })');
  });
});

describe('Wallet promotion comes from the paid rule, with its exclusions', () => {
  const rules = earnRulesFromConfig();
  it('follows the configured uplift and a lowered ceiling rather than typing fifty into UI', () => {
    expect(walletExtraPercentage(rules)).toBe(50);
    expect(walletExtraPercentage({ ...rules, walletMultiplier: 1 })).toBe(0);
    expect(walletExtraPercentage({ ...rules, walletMultiplier: 1.25 })).toBe(25);
    expect(walletExtraPercentage({ ...rules, maxEarnMultiplier: 3.5 })).toBe(16.66);
    for (const threshold of [0, 20, 65]) {
      const ctx = { total: 10, windowSpend: threshold, at: new Date('2026-10-20T12:00:00Z') };
      const ordinary = computeEarn(ctx, rules).points;
      const wallet = computeEarn({ ...ctx, paidFromBalance: true }, rules).points;
      expect(wallet).toBe(ordinary * 1.5);
      expect(computeEarn({ ...ctx, paidFromBalance: true, corporate: true }, rules).points).toBe(0);
    }
    expect(source('hooks/useWalletRate.ts')).toContain('extraPercent: walletExtraPercentage()');
    expect(source('components/home/PromoCarousel.tsx')).not.toMatch(/1\.5|50|WALLET_EARN_MULTIPLIER/);
  });

  it('both languages interpolate the percentage and explicitly exclude top-up, corporate and combo multiplication', async () => {
    for (const lang of ['ar', 'en'] as const) {
      const resources = locales(lang);
      const copy = resources.campaignSlides;
      const i18n = createInstance();
      await i18n.init({ lng: lang, resources: { [lang]: { translation: resources } } });
      for (const extra of [25, 50, 75]) expect(i18n.t('campaignSlides.walletTitle', { extra })).toContain(`${extra}%`);
      expect(copy.walletTitle).toContain('{{extra}}');
      expect(copy.walletBody).toMatch(lang === 'ar' ? /الشحن نفسه لا يمنح نقاطاً/ : /Adding balance itself earns no points/);
      expect(copy.walletExclusions).toMatch(lang === 'ar' ? /الكومبو ثابتة ولا تتضاعف/ : /combo reward is not multiplied/);
      expect(copy.walletExclusions).toMatch(lang === 'ar' ? /خصم الشركات لا تكسب نقاطاً/ : /Corporate-discount invoices earn no points/);
      const label = campaignAccessibleLabel(i18n.t('campaignSlides.walletTitle', { extra: 50 }), copy.walletBody, copy.walletAction, copy.walletExclusions);
      for (const condition of [copy.walletBody, copy.walletExclusions, copy.walletAction]) expect(label).toContain(condition);
      expect(label).toContain(lang === 'ar' ? '50% كاش باك إضافي' : '50% extra Cash back');
      const giftBoxLabel = campaignAccessibleLabel(copy.giftBoxTitle, copy.giftBoxBody, copy.contactAction);
      expect(giftBoxLabel).toContain(copy.giftBoxBody);
      for (const slide of campaignSlides(50, 50, true)) for (const key of [slide.titleKey, slide.bodyKey, slide.actionKey]) expect(copy[key], `${lang}.${key}`).toBeTruthy();
    }
    expect(source('components/home/CampaignSlideCard.tsx')).toContain('accessibilityLabel={campaignAccessibleLabel(title, body, action, exclusions)}');
  });
});
