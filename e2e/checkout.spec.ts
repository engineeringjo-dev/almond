import { test, expect, expectHealthy, parseJod, waitForHydration, ITEM_WITH_MODIFIERS } from './fixtures';

/**
 * Checkout in MOCK mode. Payment and delivery dispatch are mocked seams
 * (data/payment.ts, data/delivery.ts) — they approve instantly. The point of
 * this journey is that the flow reaches the confirmation screen and the cart
 * is emptied, not that money moves.
 */
test.describe('Checkout (mock mode)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/menu/${ITEM_WITH_MODIFIERS}`);
    await waitForHydration(page);
    await page.getByRole('button', { name: /أضف إلى السلة/ }).click();
    await expect(page.getByRole('button', { name: /تمت الإضافة/ })).toBeVisible();
  });

  test('pickup order reaches the confirmation screen', async ({ page, health }) => {
    await page.goto('/cart');
    await page.getByRole('link', { name: 'إتمام الطلب' }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole('heading', { level: 1, name: 'إتمام الطلب' })).toBeVisible();

    // Placing without a branch is refused with a message, not a crash.
    await page.getByRole('button', { name: 'تأكيد الطلب' }).click();
    await expect(page.getByText('يرجى اختيار فرع للمتابعة')).toBeVisible();

    // Pick the first branch; it reports its pressed state.
    const branches = page.getByRole('group', { name: 'اختر الفرع' }).getByRole('button');
    await branches.first().click();
    await expect(branches.first()).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'تأكيد الطلب' }).click();

    await expect(page).toHaveURL(/\/checkout\/success$/);
    await expect(page.getByRole('heading', { level: 1, name: 'تم استلام طلبك!' })).toBeVisible();
    const totalRow = page.getByText('الإجمالي', { exact: true }).locator('..');
    expect(parseJod(await totalRow.innerText())).toBeGreaterThan(0);

    // The cart was emptied by the order.
    await page.goto('/cart');
    await expect(page.getByRole('heading', { level: 1, name: 'سلتك فارغة' })).toBeVisible();

    expectHealthy(health);
  });

  test('delivery order requires an address, then succeeds', async ({ page, health }) => {
    await page.goto('/checkout');
    await page.getByRole('group', { name: 'نوع الطلب' }).getByRole('button', { name: 'توصيل' }).click();

    const branches = page.getByRole('group', { name: 'اختر الفرع' }).getByRole('button');
    await branches.first().click();

    await page.getByRole('button', { name: 'تأكيد الطلب' }).click();
    await expect(page.getByText('يرجى إدخال عنوان التوصيل')).toBeVisible();

    await page.getByRole('textbox', { name: 'عنوان التوصيل' }).fill('عمّان، الرابية، شارع ١');
    await page.getByRole('button', { name: 'تأكيد الطلب' }).click();
    await expect(page).toHaveURL(/\/checkout\/success$/);
    await expect(page.getByRole('heading', { level: 1, name: 'تم استلام طلبك!' })).toBeVisible();

    expectHealthy(health);
  });
});
