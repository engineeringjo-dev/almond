import { test, expect, expectHealthy, FORBIDDEN_IMAGE_HOST, waitForHydration } from './fixtures';

test.describe('Home', () => {
  test('loads in Arabic, RTL, with no console errors and no third-party menu photos', async ({ page, health }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);

    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'ar');
    await expect(html).toHaveAttribute('dir', 'rtl');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // The primary call to action reaches the menu.
    await expect(page.locator('main a[href="/menu"]').first()).toBeVisible();

    // Scroll the whole page so lazy images (featured row, branches) are requested.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await waitForHydration(page);

    // Every product photo on the page is ours: /menu/*.webp, served either
    // directly or through the Next.js image optimiser (?url=%2Fmenu%2F…).
    const srcs = await page.locator('main img').evaluateAll((imgs) =>
      imgs.map((i) => (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src),
    );
    const productPhotos = srcs.filter((s) => s.includes('menu'));
    expect(productPhotos.length, 'featured products show photos').toBeGreaterThan(0);
    for (const src of productPhotos) {
      const decoded = decodeURIComponent(src);
      expect(decoded, src).toMatch(/\/menu\/[^/]+\.webp/);
      expect(decoded, src).not.toContain(FORBIDDEN_IMAGE_HOST);
    }
    // Every photo actually decoded (a 404'd optimiser URL leaves naturalWidth 0).
    const broken = await page.locator('main img').evaluateAll((imgs) =>
      imgs.filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0)
        .map((i) => (i as HTMLImageElement).src),
    );
    expect(broken, 'broken images').toEqual([]);

    expectHealthy(health);
  });
});
