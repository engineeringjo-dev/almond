import { test, expect } from '@playwright/test';
import { addLatte, appUrl, cartLines, ctaAmount, LATTE, openItem, seedApp } from './helpers';

/**
 * The customer app's ordering journey on its web build — the P0 and P1
 * findings of the 2026-09-30 design/technical audit, each as the behaviour a
 * customer would see. Mock services, the shipped `expo export` bundle.
 */

test.describe('App: document language and direction', () => {
  test('Arabic: <html lang="ar" dir="rtl">', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'ar' });
    await page.goto(appUrl('/order'));
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    // …and the layout really mirrors: the first tab («الرئيسية») sits right of the last.
    const home = page.getByRole('tab', { name: /الرئيسية/ });
    const more = page.getByRole('tab', { name: /المزيد/ });
    const [h, m] = await Promise.all([home.boundingBox(), more.boundingBox()]);
    expect(h && m && h.x > m.x, 'Home should be the rightmost tab in Arabic').toBe(true);
    // The raised barcode button is one of the bar's tabs, not a stray button.
    await expect(page.getByRole('tab', { name: 'الباركود' })).toHaveCount(1);
  });

  test('English: <html lang="en" dir="ltr">', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'en' });
    await page.goto(appUrl('/order'));
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    const [h, m] = await Promise.all([
      page.getByRole('tab', { name: /Home/ }).boundingBox(),
      page.getByRole('tab', { name: /More/ }).boundingBox(),
    ]);
    expect(h && m && h.x < m.x, 'Home should be the leftmost tab in English').toBe(true);
  });
});

test.describe('App cart', () => {
  test('dine-in survives a cold start before the branches load (P0)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedApp(page, { signedIn: true });
    await addLatte(page);
    await page.goto(appUrl('/cart'));
    await page.getByRole('tab', { name: 'في المقهى' }).click();
    await expect(page.getByRole('tab', { name: 'في المقهى' })).toHaveAttribute('aria-selected', 'true');

    // Cold start with «في المقهى» persisted: the branch list is not in yet.
    await page.reload();
    await expect(page.getByText('حدث خطأ غير متوقع')).toHaveCount(0);
    await expect(page.getByText(LATTE, { exact: true }).first()).toBeVisible();
    // The branch arrives, and the review can start.
    await expect(page.getByRole('button', { name: /مراجعة الطلب/ })).toBeEnabled();
    expect(errors, 'no uncaught error on the cart').toEqual([]);
  });

  test('the combo banner names and prices its item before the tap (P1)', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await addLatte(page);
    await page.goto(appUrl('/cart'));
    const banner = page.getByRole('button', { name: /^أضف .+ بسعر \d+\.\d{3} د\.أ واكسب \d+ نقطة$/ });
    await expect(banner).toBeVisible();
    const label = (await banner.getAttribute('aria-label')) ?? '';
    const [, name, price] = /^أضف (.+) بسعر (\d+\.\d{3}) د\.أ/.exec(label) ?? [];
    // The name and the price are on screen, not only in the accessible name.
    await expect(banner).toContainText(name);
    await expect(banner).toContainText(price);
  });

  test('cart and payment controls carry roles, state and Arabic labels (P1)', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await addLatte(page);
    await page.goto(appUrl('/cart'));
    await expect(page.getByRole('button', { name: `حذف ${LATTE} من السلة` })).toBeVisible();
    await expect(page.getByRole('button', { name: `زيادة كمية ${LATTE}` })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'استلام من السيارة' })).toBeVisible();
    const payment = page.getByRole('radiogroup', { name: 'طريقة الدفع' });
    await expect(payment.getByRole('radio', { checked: true })).toHaveCount(1);
    const orderType = page.getByRole('tablist').filter({ has: page.getByRole('tab', { name: 'في المقهى' }) });
    await expect(orderType.getByRole('tab', { selected: true })).toHaveCount(1);
  });

  test('the cart has a way back, and a cold /cart deep link still works (P1)', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await addLatte(page);
    await page.goto(appUrl('/cart'));
    await expect(page).toHaveURL(/\/almond\/cart$/);
    await page.getByRole('button', { name: 'رجوع' }).click();
    await expect(page).toHaveURL(/\/almond\/order$/);

    // Cold deep link: nothing behind the cart, so «رجوع» falls back to the menu.
    await page.goto(appUrl('/cart'));
    await expect(page.getByText(LATTE, { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'رجوع' }).click();
    await expect(page).toHaveURL(/\/almond\/order$/);
  });
});

test.describe('App item sheet', () => {
  test('a pairing chip toggles; «أضف للسلة» adds it once, at the total it showed (P1)', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await openItem(page, LATTE);
    const sheet = page.getByRole('dialog');
    const cta = sheet.getByText(/أضف للسلة/);
    const base = ctaAmount(await cta.innerText());

    const pairing = sheet.getByRole('group', { name: 'يُطلب عادةً مع' }).getByRole('checkbox').first();
    const name = ((await pairing.getAttribute('aria-label')) ?? '').split('،')[0];
    await pairing.click();
    await expect(pairing).toHaveAttribute('aria-checked', 'true');
    const withPairing = ctaAmount(await cta.innerText());
    expect(withPairing).toBeGreaterThan(base);

    // A second tap takes it back off — it never adds by itself.
    await pairing.click();
    await expect(pairing).toHaveAttribute('aria-checked', 'false');
    expect(ctaAmount(await cta.innerText())).toBe(base);
    expect(await cartLines(page)).toEqual([]);

    await pairing.click();
    await cta.click();
    await expect(sheet).toBeHidden();
    expect((await cartLines(page)).sort()).toEqual([`${LATTE} ×1`, `${name} ×1`].sort());
  });

  test('sizes and options announce their choice (P1)', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await openItem(page, LATTE);
    const sheet = page.getByRole('dialog');
    const sizes = sheet.getByRole('radiogroup', { name: 'الحجم' });
    await expect(sizes.getByRole('radio', { checked: true })).toHaveCount(1);
    const otherName = (await sizes.getByRole('radio', { checked: false }).first().getAttribute('aria-label')) ?? '';
    const other = sizes.getByRole('radio', { name: otherName, exact: true });
    await other.click();
    await expect(other).toHaveAttribute('aria-checked', 'true');
    await expect(sizes.getByRole('radio', { checked: true })).toHaveCount(1);
    // «إضافات» takes many answers: checkboxes, priced in the name.
    const extras = sheet.getByRole('group', { name: 'إضافات' });
    await expect(extras.getByRole('checkbox').first()).toHaveAccessibleName(/، \+\d+\.\d{3} د\.أ$/);
  });
});

test.describe('App checkout gate', () => {
  test('a guest who signs in at «مراجعة الطلب» lands back on the review (P1)', async ({ page }) => {
    await seedApp(page, { signedIn: false });
    await addLatte(page);
    await page.goto(appUrl('/cart'));
    await page.getByRole('button', { name: /مراجعة الطلب/ }).click();
    await expect(page).toHaveURL(/\/almond\/login\?returnTo=/);

    await page.locator('input[inputmode="tel"], input[type="tel"]').last().fill('790000000');
    await page.getByText('إرسال الرمز', { exact: true }).click();
    await expect(page).toHaveURL(/\/almond\/otp\?/);
    await page.keyboard.type('123456');

    await expect(page).toHaveURL(/\/almond\/cart$/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('راجع طلبك')).toBeVisible();
  });

  test('a hostile returnTo is ignored — sign-in goes home, not off-site', async ({ page }) => {
    await seedApp(page, { signedIn: false });
    await page.goto(appUrl('/login?returnTo=' + encodeURIComponent('//evil.example/cart')));
    await page.locator('input[inputmode="tel"], input[type="tel"]').last().fill('790000000');
    await page.getByText('إرسال الرمز', { exact: true }).click();
    await expect(page).toHaveURL(/\/almond\/otp\?phone=[^&]+$/);
    await page.keyboard.type('123456');
    await expect(page).toHaveURL(/^http:\/\/localhost:3200\/almond\/?$/);
  });
});
