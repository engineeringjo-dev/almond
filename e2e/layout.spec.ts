import { test, expect, horizontalOverflow, waitForHydration, ITEM_WITH_MODIFIERS } from './fixtures';

/**
 * No horizontal scroll. On a phone, a page wider than the screen means the whole
 * layout slides sideways under the thumb — in RTL it usually comes from a
 * physical `left/right/ml/mr` utility or an off-canvas element positioned for LTR.
 */
const PAGES = [
  '/',
  '/menu',
  `/menu/${ITEM_WITH_MODIFIERS}`,
  '/cart',
  '/checkout',
  '/rewards',
  '/branches',
  '/gifts',
  '/login',
  '/admin',
  '/en',
  '/en/menu',
  `/en/menu/${ITEM_WITH_MODIFIERS}`,
];

test.describe('No horizontal scroll', () => {
  for (const path of PAGES) {
    test(`${path}`, async ({ page }) => {
      await page.goto(path);
      await waitForHydration(page);
      const { scrollWidth, clientWidth } = await horizontalOverflow(page);
      expect(scrollWidth, `${path}: scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(clientWidth);
    });
  }

  test('cart and checkout with a line in them', async ({ page }) => {
    await page.goto(`/menu/${ITEM_WITH_MODIFIERS}`);
    await waitForHydration(page);
    await page.getByRole('button', { name: /أضف إلى السلة/ }).click();
    for (const path of ['/cart', '/checkout']) {
      await page.goto(path);
      await waitForHydration(page);
      const { scrollWidth, clientWidth } = await horizontalOverflow(page);
      expect(scrollWidth, `${path}`).toBeLessThanOrEqual(clientWidth);
    }
  });

  test('mobile menu panel open', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'hamburger panel is mobile-only');
    await page.goto('/');
    await waitForHydration(page);
    await page.getByRole('button', { name: 'فتح القائمة' }).click();
    const { scrollWidth, clientWidth } = await horizontalOverflow(page);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
