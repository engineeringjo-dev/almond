import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { carouselStep, settleIndex, SWIPE_FRACTION } from '@/lib/carousel';
import { buildHomeSlides, type HomeSlide } from '@/lib/homeSlides';
import { bestSellers, isOccasionItem } from '@almond/shared/lib/recommendations';
import { categoryKind } from '@almond/shared/lib/categoryKind';
import { itemInsights } from '@almond/shared/menu/menu.insights.generated';
import { menuItems } from '@almond/shared/menu';
import type { MenuItem } from '@/types';

/**
 * H1-H6 — HOME IN FOUR BLOCKS, AND THE CAROUSEL THAT EXPLORES (owner and
 * expert panel, 2026-10-15).
 */
const APP = join(__dirname, '..');
const code = (rel: string): string =>
  readFileSync(join(APP, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('H1 the carousel turns the right way in both directions', () => {
  const base = { index: 2, vx: 0, slideWidth: 300, last: 5 };

  it('the row sits one step per slide, toward the reading direction', () => {
    expect(carouselStep(0, 312, -1)).toBe(0);
    expect(carouselStep(3, 312, -1)).toBe(-936); // English: the row moves left
    expect(carouselStep(3, 312, 1)).toBe(936); // Arabic: the row moves right
  });

  it('in Arabic a swipe to the RIGHT brings the next slide', () => {
    expect(settleIndex({ ...base, dx: 120, rtl: true })).toBe(3);
    expect(settleIndex({ ...base, dx: -120, rtl: true })).toBe(1);
  });

  it('in English a swipe to the LEFT brings the next slide', () => {
    expect(settleIndex({ ...base, dx: -120, rtl: false })).toBe(3);
    expect(settleIndex({ ...base, dx: 120, rtl: false })).toBe(1);
  });

  it('a short, slow drag is a wobble; a short flick is a turn', () => {
    const short = 300 * SWIPE_FRACTION - 5;
    expect(settleIndex({ ...base, dx: short, rtl: true })).toBe(2);
    expect(settleIndex({ ...base, dx: 30, vx: 0.8, rtl: true })).toBe(3);
  });

  it('never past either end', () => {
    expect(settleIndex({ ...base, index: 5, dx: 200, rtl: true })).toBe(5);
    expect(settleIndex({ ...base, index: 0, dx: -200, rtl: true })).toBe(0);
  });
});

describe('H2 «الأكثر طلباً» is measured, not a sample', () => {
  const orders = (m: MenuItem) => itemInsights[m.id]?.orders ?? 0;

  it('ranks by paid orders, most first, and only what a row of photos can offer', () => {
    const top = bestSellers(40, { items: menuItems });
    expect(top.length).toBe(40);
    const counts = top.map(orders);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    for (const m of top) {
      expect(orders(m), `${m.nameEn} has no measured orders`).toBeGreaterThan(0);
      expect(m.imageUrl, `${m.nameEn} has no photo`).toBeTruthy();
      expect(['drink', 'food']).toContain(categoryKind(m.categoryId));
      expect(isOccasionItem(m), `${m.nameEn} is bought for an occasion`).toBe(false);
    }
  });

  it('water, the best seller of all, is not offered: it is neither a drink nor a food here', () => {
    const water = menuItems.find((m) => /water/i.test(m.nameEn) && orders(m) > 0);
    expect(water, 'the measured water line is the premise of this test').toBeTruthy();
    expect(bestSellers(50, { items: menuItems }).map((m) => m.id)).not.toContain(water!.id);
  });

  it('narrows to a kind, and the top drink is the most ordered photographed drink', () => {
    const [drink] = bestSellers(1, { kind: 'drink', items: menuItems });
    const expected = menuItems
      .filter((m) => m.imageUrl && m.inStock !== false && categoryKind(m.categoryId) === 'drink' && !isOccasionItem(m))
      .sort((a, b) => orders(b) - orders(a))[0];
    expect(drink?.id).toBe(expected?.id);
    expect(bestSellers(5, { kind: 'food', items: menuItems }).every((m) => categoryKind(m.categoryId) === 'food')).toBe(true);
  });
});

describe('H2b every row headed «الأكثر طلباً» is ranked by bestSellers', () => {
  // Three rows said "most ordered" and none was: the Home row and the Order
  // tab's strip took the first photographed item of each category, and the
  // website every Nth photographed item.
  it('the Order tab\'s strip, the Home carousel and the website row', () => {
    const order = code('app/(tabs)/order.tsx');
    expect(order).toMatch(/t\('order\.trending'\)/);
    expect(order).toMatch(/const trending = useMemo\(\(\) => bestSellers\(/);
    expect(code('lib/homeSlides.ts')).toMatch(/bestSellers\(1, \{ kind, items: ctx\.items \}\)/);
    const web = readFileSync(join(APP, '..', 'almond-web', 'src', 'data', 'featured.ts'), 'utf8');
    expect(web).toMatch(/return bestSellers\(limit\)/);
  });
});

describe('H3 the carousel slides', () => {
  const ctx = {
    lang: 'ar' as const,
    items: menuItems,
    walletRate: { rate: '3%', base: '2%' },
    range: { low: '2%', high: '6%', mult: '1.5', max: '9%' },
    formatPrice: (jod: number) => `${jod.toFixed(3)} JOD`,
  };
  const slides = buildHomeSlides(ctx);

  it('best drink, best food, then what the programme pays', () => {
    expect(slides.map((s) => s.id)).toEqual(['best-drink', 'best-food', 'wallet', 'gift', 'rewards']);
  });

  it('a best seller is named by its own name, said to be among the most ordered, and opens itself', () => {
    const drink = slides[0]!;
    const [top] = bestSellers(1, { kind: 'drink', items: menuItems });
    expect(drink.title).toEqual({ text: top!.nameAr });
    expect(drink.subtitle).toEqual({ key: 'home.mostOrdered' });
    expect(drink.photo).toBe(top!.imageUrl);
    expect(drink.action).toEqual({ kind: 'item', itemId: top!.id });
  });

  it('a programme slide is a locale sentence, with the rates read off the dials', () => {
    const byId = (id: string) => slides.find((s) => s.id === id) as HomeSlide;
    expect(byId('wallet').title).toEqual({ key: 'home.walletHint', params: ctx.walletRate });
    expect(byId('rewards').title).toEqual({ key: 'rewards.headline', params: { max: '9%' } });
    expect(byId('rewards').subtitle).toEqual({ key: 'home.rewardsSlide', params: { low: '2%', high: '6%', mult: '1.5' } });
    for (const s of slides.filter((x) => !x.id.startsWith('best-'))) {
      expect('key' in s.title, `${s.id}: a literal is invisible to every copy test`).toBe(true);
    }
  });

  it('a menu with nothing measured shows no best-seller slide rather than a sample', () => {
    const unmeasured = menuItems.filter((m) => !itemInsights[m.id]);
    expect(buildHomeSlides({ ...ctx, items: unmeasured }).map((s) => s.id)).toEqual(['wallet', 'gift', 'rewards']);
  });
});

describe('H4 Home is four blocks, in order, with no wrapper around one that can be empty', () => {
  const home = code('app/(tabs)/index.tsx');

  it('the card, order, the offers, the usual — in that order', () => {
    const at = ['<LoyaltyCard', '<OrderNowButton', '<PromoCarousel', '<UsualOrderCard'].map((tag) => home.indexOf(tag));
    expect(at.every((i) => i > 0), 'all four blocks are on Home').toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('a block that can render nothing is not wrapped: the wrapper would stay as a blank', () => {
    // The 76pt gap the experts measured was ActiveOrderBanner's section View.
    for (const tag of ['ActiveOrderBanner', 'PromotionBanner', 'UsualOrderCard', 'ChallengeBanner', 'HomeNudge']) {
      const re = new RegExp(String.raw`<View[^>]*>\s*<${tag}\b`);
      expect(re.test(home), `<${tag} /> is wrapped in a View on Home`).toBe(false);
    }
  });

  it('the old stack is gone: wallet, gift, nearest-branch and best-seller cards, the branch list', () => {
    for (const gone of ['WalletCard', 'GiftCardHome', 'NearestBranchButton', 'FeaturedRow', 'BranchCard']) {
      expect(home).not.toContain(`<${gone}`);
    }
  });
});

describe('H5 the code is never hidden behind the branches', () => {
  it('Home does not hand the branches\' loading or error to the screen', () => {
    // A GPS fix can take seconds; the card and its code do not need it.
    const home = code('app/(tabs)/index.tsx');
    const screen = /<Screen\b[^>]*>/.exec(home)?.[0] ?? '';
    expect(screen).toBeTruthy();
    expect(screen).not.toMatch(/\bloading=/);
    expect(screen).not.toMatch(/\berror=/);
  });

  it('the header has no cart icon: the order block offers the cart when it holds something', () => {
    const bar = code('components/home/HomeTopBar.tsx');
    expect(bar).not.toMatch(/name="cart"/);
    expect(bar).not.toMatch(/useCartCount/);
    expect(code('components/home/OrderNowButton.tsx')).toMatch(/router\.push\('\/cart'\)/);
  });
});

describe('H6 the membership card carries the wallet and names its own button', () => {
  const card = code('components/home/LoyaltyCard.tsx');

  it('the wallet balance is a line of the card, and opens the wallet', () => {
    expect(card).toMatch(/useWallet\(\)/);
    expect(card).toMatch(/router\.push\('\/profile\/wallet'\)/);
  });

  it('«اعرض رمزك» is the button\'s accessible name (WCAG 2.5.3, label in name)', () => {
    // From the button's onPress to its icon: the button's own props. (Up to
    // the first `>` would stop inside the style's arrow function.)
    const btn = /onPress=\{\(\) => openEarnSheet\(\)\}([\s\S]*?)<Icon name="qr"/.exec(card)?.[1] ?? '';
    expect(btn).toBeTruthy();
    expect(btn).not.toMatch(/accessibilityLabel/);
  });
});
