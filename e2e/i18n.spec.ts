import { test, expect, waitForHydration } from './fixtures';

test.describe('Language switch', () => {
  test('Arabic → English flips lang/dir and keeps the page', async ({ page, isMobile }) => {
    await page.goto('/menu');
    await waitForHydration(page);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'ar');
    await expect(html).toHaveAttribute('dir', 'rtl');

    // On mobile the switcher lives in the hamburger panel; on desktop, in the header.
    if (isMobile) await page.getByRole('button', { name: 'فتح القائمة' }).click();
    const switcher = page.getByRole('group', { name: 'اللغة' });
    const toEnglish = switcher.getByRole('button', { name: 'EN', exact: true });
    await expect(switcher.getByRole('button', { name: 'عربي', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(toEnglish).toHaveAttribute('aria-pressed', 'false');
    await toEnglish.click();

    await expect(page).toHaveURL(/\/en\/menu$/);
    await expect(html).toHaveAttribute('lang', 'en');
    await expect(html).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible();
  });

  test('English pages render LTR directly', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  // BUG (outside the UI's ownership — src/i18n/routing.ts + src/middleware.ts):
  // switching English → Arabic can silently fail and leave the visitor in
  // English. With `localePrefix: 'as-needed'` and locale detection ON, the
  // middleware (a) answers EVERY /en/* request — including the RSC prefetches
  // that the English page's <Link>s keep firing — with
  // `Set-Cookie: NEXT_LOCALE=en`, and (b) redirects the unprefixed /menu to
  // /en/menu when that cookie says "en". So if any /en/* prefetch lands between
  // the click (which sets NEXT_LOCALE=ar client-side) and the navigation
  // request, the cookie flips back and GET /menu → 307 /en/menu.
  // Seen in the wild in this suite (desktop, ~1 run in 4); reproduced
  // deterministically below by holding the navigation and letting one English
  // prefetch through first.
  // FIXED 2026-09-23: `localeDetection: false` + `localeCookie: false` in
  // src/i18n/routing.ts — the URL is the only source of truth (unprefixed =
  // Arabic). This test is the regression guard.
  test('English → Arabic is not undone by an in-flight English prefetch', async ({ page, context }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route((url) => url.pathname === '/menu', async (route) => {
      await gate;
      await route.continue();
    });

    await page.goto('/en/menu');
    await waitForHydration(page);
    if (await page.getByRole('button', { name: 'Open menu' }).isVisible()) {
      await page.getByRole('button', { name: 'Open menu' }).click();
    }
    await page.getByRole('button', { name: 'عربي', exact: true }).click();
    // A still-mounted English <Link> prefetch lands before the navigation:
    await page.evaluate(() => fetch('/en/branches', { headers: { RSC: '1', 'Next-Router-Prefetch': '1' } }));
    release();

    await expect(page).toHaveURL(/localhost:\d+\/menu$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    // The fix makes the URL the ONLY source of truth: no locale cookie is set at
    // all, so no prefetch can ever write one that outvotes the address bar.
    expect((await context.cookies()).find((c) => c.name === 'NEXT_LOCALE')).toBeUndefined();
  });
});

/**
 * Direction-aware icons. In Arabic a "back" chevron must point RIGHT and a
 * "forward" one LEFT; lucide draws them for LTR, so they carry `rtl:rotate-180`.
 * The upsell nudge used a LEFT chevron (pointing backwards in BOTH languages)
 * and the "go to cart" link a literal "→" — both fixed; this keeps them fixed.
 */
test.describe('RTL icon direction', () => {
  const MULTI_SIZE_ITEM = 'p-10367';

  /** True when the element is drawn rotated by 180° (computed matrix a ≈ −1). */
  async function flipped(locator: import('@playwright/test').Locator): Promise<boolean> {
    return locator.evaluate((el) => {
      const t = getComputedStyle(el).transform;
      if (!t || t === 'none') return false;
      const a = Number(t.slice(t.indexOf('(') + 1).split(',')[0]);
      return a < -0.99;
    });
  }

  for (const [locale, prefix, back, upsize, rotated] of [
    ['ar', '', 'عودة إلى المنيو', /كبّر إلى/, true],
    ['en', '/en', 'Back to menu', /^Go /, false],
  ] as const) {
    test(`${locale}: back and forward chevrons point the right way`, async ({ page }) => {
      await page.goto(`${prefix}/menu/${MULTI_SIZE_ITEM}`);
      await waitForHydration(page);

      const backIcon = page.getByRole('link', { name: back }).locator('svg');
      await expect(backIcon).toHaveClass(/lucide-chevron-left/);
      expect(await flipped(backIcon)).toBe(rotated);

      const upsell = page.getByRole('button', { name: upsize });
      if (await upsell.count()) {
        const fwd = upsell.locator('svg');
        await expect(fwd).toHaveClass(/lucide-chevron-right/);
        expect(await flipped(fwd)).toBe(rotated);
      }

      // After adding, the "go to cart" link has an arrow icon, not a text glyph.
      await page.getByRole('button', { name: locale === 'ar' ? /أضف إلى السلة/ : /Add to cart/ }).click();
      const toCart = page.locator('main a[href$="/cart"]');
      await expect(toCart).toBeVisible();
      await expect(toCart).not.toContainText('→');
      expect(await flipped(toCart.locator('svg'))).toBe(rotated);
    });
  }
});
