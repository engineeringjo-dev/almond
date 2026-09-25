import { test, expect, expectHealthy, parseJod, waitForHydration, ITEM_WITH_MODIFIERS } from './fixtures';

test.describe('Menu', () => {
  test('categories and items render with local photos', async ({ page, health }) => {
    await page.goto('/menu');
    await expect(page.getByRole('heading', { level: 1, name: 'المنيو' })).toBeVisible();

    // Category sections: one <h2> per category, and the rail offers a chip each.
    const categoryHeadings = page.locator('main section[id^="cat-"] > h2');
    expect(await categoryHeadings.count()).toBeGreaterThan(5);

    // Item cards link to their item page and show a price.
    const cards = page.locator('main a[href*="/menu/p-"]');
    expect(await cards.count()).toBeGreaterThan(50);
    const first = cards.first();
    await expect(first.getByRole('heading', { level: 3 })).not.toBeEmpty();
    expect(parseJod(await first.innerText())).toBeGreaterThan(0);

    // The first category's photos are local webp files and actually decode.
    const firstSectionImgs = page.locator('main section[id^="cat-"]').first().locator('img');
    await expect(firstSectionImgs.first()).toBeVisible();
    await expect.poll(async () =>
      firstSectionImgs.first().evaluate((i) => (i as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    const src = decodeURIComponent(await firstSectionImgs.first().evaluate((i) => (i as HTMLImageElement).currentSrc));
    expect(src).toMatch(/\/menu\/[^/]+\.webp/);

    await waitForHydration(page);
    expectHealthy(health);
  });

  test('search filters the menu', async ({ page }) => {
    await page.goto('/menu');
    await waitForHydration(page);
    await page.getByRole('searchbox').fill('bagel');
    const results = page.locator('main a[href*="/menu/p-"]');
    await expect(results.first()).toBeVisible();
    const count = await results.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(100);
  });

  test('item page: modifiers, add to cart, cart total > 0', async ({ page, health }) => {
    await page.goto(`/menu/${ITEM_WITH_MODIFIERS}`);
    await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
    await waitForHydration(page);

    // ItemConfigurator contract: SINGLE-choice groups are pre-selected with
    // their first option (so the shown price is a complete configuration);
    // multi-choice groups start empty. Every option button reports its state.
    const options = page.locator('main button[aria-pressed]');
    expect(await options.count()).toBeGreaterThan(0);
    for (const group of await page.locator('[data-choice="single"]').all()) {
      await expect(group.locator('button[aria-pressed="true"]')).toHaveCount(1);
    }

    const add = page.getByRole('button', { name: /أضف إلى السلة/ });
    const shown = parseJod(await add.innerText());
    expect(shown, 'price on the add button').toBeGreaterThan(0);

    // Choosing an option that is not selected presses it. (The first button
    // may be a pre-selected single choice — Bagel Type is radio in Odoo — and
    // pressing a chosen radio leaves it chosen, so pick an unpressed one.)
    const states = await options.evaluateAll((els) => els.map((e) => e.getAttribute('aria-pressed')));
    const idx = states.indexOf('false');
    expect(idx, 'an unselected option exists').toBeGreaterThanOrEqual(0);
    const firstOption = options.nth(idx);
    await firstOption.click();
    await expect(firstOption).toHaveAttribute('aria-pressed', 'true');

    // Quantity 2 doubles the total on the button.
    const unit = parseJod(await add.innerText());
    await page.getByRole('button', { name: 'زيادة الكمية' }).click();
    await expect.poll(async () => parseJod(await add.innerText())).toBeCloseTo(unit * 2, 3);

    await add.click();
    await expect(page.getByRole('button', { name: /تمت الإضافة/ })).toBeVisible();

    // The header cart badge counts the two units.
    await expect(page.getByRole('link', { name: /السلة/ }).first()).toContainText('2');

    await page.goto('/cart');
    await expect(page.getByRole('heading', { level: 1, name: 'سلة الطلبات' })).toBeVisible();
    const totalRow = page.getByText('الإجمالي', { exact: true }).locator('..');
    const total = parseJod(await totalRow.innerText());
    expect(total, 'cart total').toBeGreaterThan(0);
    expect(total).toBeGreaterThanOrEqual(unit * 2);

    expectHealthy(health);
  });

  test('quick add from the menu list puts a priced line in the cart', async ({ page }) => {
    await page.goto('/menu');
    await waitForHydration(page);
    // The quick-add control is a sibling of the card link (not nested inside
    // it) and names the item it adds.
    const quickAdd = page.getByRole('button', { name: /^أضف .+ إلى السلة$/ }).first();
    await quickAdd.click();
    await expect(page.getByRole('link', { name: /السلة/ }).first()).toContainText('1');
    await page.goto('/cart');
    const totalRow = page.getByText('الإجمالي', { exact: true }).locator('..');
    expect(parseJod(await totalRow.innerText())).toBeGreaterThan(0);
  });

  // BUG (outside the UI's ownership — menu data): Odoo's "Bagel Type" attribute
  // is a required, single-choice radio at the till, but scripts/odoo-menu-pull.ts
  // (≈ line 276–281) emits EVERY attribute as `multiple: true`, so the generated
  // menu (packages/shared/src/menu/menu.generated.ts) contains zero single-choice
  // groups. Result: a bagel can be added with NO bagel type, or with several.
  // Repro: open /menu/p-10170, press «أضف إلى السلة» without choosing a type —
  // the line is added. Expected: a type is pre-selected (single choice) or the
  // add button is disabled until one is chosen.
  test.fixme('a required single-choice modifier (Bagel Type) cannot be skipped', async ({ page }) => {
    await page.goto(`/menu/${ITEM_WITH_MODIFIERS}`);
    await waitForHydration(page);
    const group = page.getByRole('group', { name: /نوع البيغل/ });
    const pressed = group.locator('button[aria-pressed="true"]');
    const add = page.getByRole('button', { name: /أضف إلى السلة/ });
    // Either exactly one type is pre-selected…
    const preselected = await pressed.count();
    if (preselected !== 1) {
      // …or adding is blocked until the customer picks one.
      await expect(add).toBeDisabled();
    }
  });
});
