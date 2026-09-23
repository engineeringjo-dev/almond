import type { Page } from '@playwright/test';
import { test, expect, blockingViolations, waitForHydration, ITEM_WITH_MODIFIERS } from './fixtures';

/**
 * axe-core on the pages a customer (and an admin) actually lands on. The build
 * fails on `critical` and `serious` violations; `moderate`/`minor` are attached
 * to the report for triage but do not fail.
 *
 * The app banner is left ON here (dismissAppBanner: false) so it is scanned too.
 */
test.use({ dismissAppBanner: false });

async function scan(page: Page, label: string) {
  await waitForHydration(page);
  const { blocking, summary } = await blockingViolations(page);
  await test.info().attach(`axe-${label}.json`, {
    body: JSON.stringify(summary, null, 2),
    contentType: 'application/json',
  });
  const readable = blocking.map((v) => ({
    rule: v.id,
    impact: v.impact,
    count: v.nodes.length,
    help: v.help,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
  }));
  expect(readable, `serious/critical axe violations on ${label}`).toEqual([]);
}

test.describe('Accessibility (axe)', () => {
  test('home (ar)', async ({ page }) => {
    await page.goto('/');
    await scan(page, 'home-ar');
  });

  test('home (en)', async ({ page }) => {
    await page.goto('/en');
    await scan(page, 'home-en');
  });

  test('menu', async ({ page }) => {
    await page.goto('/menu');
    await scan(page, 'menu');
  });

  test('menu with search results', async ({ page }) => {
    await page.goto('/menu');
    await waitForHydration(page);
    await page.getByRole('searchbox').fill('latte');
    await scan(page, 'menu-search');
  });

  test('item page', async ({ page }) => {
    await page.goto(`/menu/${ITEM_WITH_MODIFIERS}`);
    await scan(page, 'item');
  });

  test('mobile menu panel', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'hamburger panel is mobile-only');
    await page.goto('/');
    await waitForHydration(page);
    await page.getByRole('button', { name: 'فتح القائمة' }).click();
    await scan(page, 'nav-panel');
  });

  test('cart (empty)', async ({ page }) => {
    await page.goto('/cart');
    await scan(page, 'cart-empty');
  });

  test('cart (with a line) and checkout', async ({ page }) => {
    await page.goto(`/menu/${ITEM_WITH_MODIFIERS}`);
    await waitForHydration(page);
    await page.getByRole('button', { name: /أضف إلى السلة/ }).click();
    await page.goto('/cart');
    await scan(page, 'cart');
    await page.goto('/checkout');
    await waitForHydration(page);
    await page.getByRole('group', { name: 'نوع الطلب' }).getByRole('button', { name: 'توصيل' }).click();
    await scan(page, 'checkout-delivery');
  });

  test('admin login', async ({ page }) => {
    await page.goto('/admin');
    await scan(page, 'admin-login');
  });

  test('admin login with an error shown', async ({ page }) => {
    await page.goto('/admin');
    await waitForHydration(page);
    await page.getByLabel('كلمة المرور').fill('wrong');
    await page.getByRole('button', { name: 'دخول' }).click();
    await expect(page.getByText('كلمة مرور غير صحيحة')).toBeVisible();
    await scan(page, 'admin-login-error');
  });

  // Secondary pages — not in the core journey, but a customer reaches them from
  // the header and footer.
  for (const path of ['/rewards', '/branches', '/gifts', '/wallet', '/login', '/careers', '/franchise']) {
    test(`secondary page ${path}`, async ({ page }) => {
      await page.goto(path);
      await scan(page, path.slice(1));
    });
  }
});
