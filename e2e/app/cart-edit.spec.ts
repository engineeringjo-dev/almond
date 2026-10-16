import { test, expect, type Page } from '@playwright/test';
import { cartLineFor } from '@almond/shared/cart';
import { categories, menuItems } from '@almond/shared/menu/seed';
import { buildAppMenuPayload } from '@almond/shared/menu/remote';
import type { CartCustomization, CartItem, MenuItem } from '@almond/shared/types';
import { appUrl, ctaAmount, LATTE, seedApp } from './helpers';

const drink = menuItems.find((m) => m.nameAr === LATTE)!;
const oatGroup = drink.customizations.find((g) => g.options.some((o) => /oat milk/i.test(o.nameEn)))!;
const oat = oatGroup.options.find((o) => /oat milk/i.test(o.nameEn))!;
const configured: CartCustomization[] = drink.customizations.flatMap((g) => {
  const option = g.id === oatGroup.id ? oat : g.options[0];
  return option ? [{ groupId: g.id, optionId: option.id, nameAr: option.nameAr, nameEn: option.nameEn, priceDelta: option.priceDelta }] : [];
});
const companionItem = menuItems.find((m) => /almond croissant/i.test(m.nameEn))!;
const companion = cartLineFor(companionItem, companionItem.sizes[0], [], 1);
const original = cartLineFor(drink, drink.sizes[1], configured, 2);
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function storedCart(page: Page): Promise<{ items: CartItem[]; branchId: string; paymentMethod: string; curbside: boolean; carInfo: string }> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('almond.cart') ?? '{}').state);
}

async function cartWith(page: Page, items: CartItem[], lang: 'ar' | 'en' = 'ar', menu: MenuItem[] = menuItems) {
  await seedApp(page, { signedIn: true, lang });
  await page.clock.install({ time: new Date('2026-10-16T12:00:00+03:00') });
  await page.clock.resume();
  const payload = buildAppMenuPayload({ categories, items: menu, updatedAt: '2099-01-01', assetBase: 'https://almond-gules.vercel.app' });
  await page.route('**/api/menu/app', (route) => route.fulfill({ json: payload }));
  await page.addInitScript(({ lines, menuPayload }) => {
    if (sessionStorage.getItem('e2e.cart-edit.seeded')) return;
    sessionStorage.setItem('e2e.cart-edit.seeded', '1');
    localStorage.setItem('almond.menu.schema1', JSON.stringify(menuPayload));
    localStorage.setItem('almond.cart', JSON.stringify({ version: 1, state: {
      items: lines, orderType: 'pickup', branchId: 'rabyeh', branchNames: { nameAr: 'الرابية', nameEn: 'Rabyeh' },
      paymentMethod: 'visa', paidFromBalance: false, curbside: true, carInfo: 'Blue car',
    } }));
  }, { lines: items, menuPayload: payload });
  await page.goto(appUrl('/cart'));
  await expect(page.getByRole('button', { name: lang === 'ar' ? `تعديل ${drink.nameAr}` : `Edit ${drink.nameEn}` }).first()).toBeVisible({ timeout: 20_000 });
}

test.describe('App cart: edit a configured item', () => {
  test('Arabic: preloads all choices, Cancel discards a draft, Save replaces the line and leaves its pairing alone', async ({ page }) => {
    await cartWith(page, [original, companion]);
    const edit = page.getByRole('button', { name: `تعديل ${drink.nameAr}` });
    await edit.click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toHaveAccessibleName(`تعديل ${drink.nameAr}`);
    await expect(sheet.getByRole('radiogroup', { name: 'الحجم' }).getByRole('radio', { name: new RegExp(escaped(drink.sizes[1].nameAr)) })).toHaveAttribute('aria-checked', 'true');
    for (const choice of configured) {
      const group = drink.customizations.find((g) => g.id === choice.groupId)!;
      const scope = sheet.getByRole(group.multiple ? 'group' : 'radiogroup', { name: group.nameAr, exact: true });
      await expect(scope.getByRole(group.multiple ? 'checkbox' : 'radio', { name: new RegExp(`^${escaped(choice.nameAr)}(?:،|$)`) })).toHaveAttribute('aria-checked', 'true');
    }
    await expect(sheet.getByRole('group', { name: 'يُطلب عادةً مع' })).toHaveCount(0);
    await sheet.getByRole('button', { name: `زيادة كمية ${drink.nameAr}` }).click();
    await sheet.getByRole('radiogroup', { name: 'الحجم' }).getByRole('radio').first().click();
    await sheet.getByRole('button', { name: 'إلغاء', exact: true }).click();
    await expect(sheet).toBeHidden();
    expect((await storedCart(page)).items).toEqual([original, companion]);

    await edit.click();
    await expect(sheet.getByRole('radiogroup', { name: 'الحجم' }).getByRole('radio').last()).toHaveAttribute('aria-checked', 'true');
    await sheet.getByRole('button', { name: `زيادة كمية ${drink.nameAr}` }).click();
    await sheet.getByRole('radiogroup', { name: 'الحجم' }).getByRole('radio').first().click();
    await sheet.getByRole('button', { name: /^حفظ التعديلات/ }).click();
    await expect(sheet).toBeHidden();
    const after = await storedCart(page);
    expect(after.items).toEqual([cartLineFor(drink, drink.sizes[0], configured, 3), companion]);
    expect(after).toMatchObject({ branchId: 'rabyeh', paymentMethod: 'visa', curbside: true, carInfo: 'Blue car' });
    await page.reload();
    await expect(page.getByRole('button', { name: `تعديل ${drink.nameAr}` })).toBeVisible();
    expect((await storedCart(page)).items).toEqual(after.items);
  });

  test('English: collision discloses the full merged quantity and current price before repricing existing units', async ({ page }) => {
    const oldDrink = { ...drink, sizes: drink.sizes.map((s) => ({ ...s, price: s.id === 'S' ? 2 : 3 })) };
    const currentDrink = { ...oldDrink, sizes: oldDrink.sizes.map((s) => s.id === 'M' ? { ...s, price: 4 } : s) };
    const source = cartLineFor(oldDrink, oldDrink.sizes[0], [], 2);
    const destination = cartLineFor(oldDrink, oldDrink.sizes[1], [], 3);
    const updatedMenu = menuItems.map((m) => m.id === drink.id ? currentDrink : m);
    await cartWith(page, [source, destination], 'en', updatedMenu);
    await page.getByRole('button', { name: `Edit ${drink.nameEn}` }).first().click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('radiogroup', { name: 'Size' }).getByRole('radio').last().click();
    const notice = sheet.getByText(/matches another item in your cart/);
    await expect(notice).toContainText('5');
    await expect(notice).toContainText('4.000');
    await expect(notice).toContainText('20.000');
    await expect(notice).toContainText('full quantity');
    // The Save amount includes the existing three units being repriced,
    // rather than showing only the edited two units at the new price (8).
    expect(ctaAmount(await sheet.getByRole('button', { name: /^Save changes/ }).innerText())).toBe(20);
    expect((await storedCart(page)).items).toEqual([source, destination]);
    await sheet.getByRole('button', { name: /^Save changes/ }).click();
    await expect(sheet).toBeHidden();
    expect((await storedCart(page)).items).toEqual([cartLineFor(currentDrink, currentDrink.sizes[1], [], 5)]);
    await expect(page.getByRole('button', { name: `Edit ${drink.nameEn}` })).toHaveCount(1);
  });

  test('a removed option stays visible and blocks Save until the customer explicitly removes it', async ({ page }) => {
    const updatedMenu = menuItems.map((m) => m.id !== drink.id ? m : {
      ...m, customizations: m.customizations.map((g) => g.id !== oatGroup.id ? g : { ...g, options: g.options.filter((o) => o.id !== oat.id) }),
    });
    await cartWith(page, [original, companion], 'ar', updatedMenu);
    await page.getByRole('button', { name: `تعديل ${drink.nameAr}` }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('alert')).toContainText('بعض اختياراتك لم تعد متوفرة');
    await expect(sheet.getByRole('button', { name: /^حفظ التعديلات/ })).toBeDisabled();
    expect((await storedCart(page)).items).toEqual([original, companion]);
    await sheet.getByRole('button', { name: `حذف ${oat.nameAr} من التعديل` }).click();
    await sheet.getByRole('button', { name: /^حفظ التعديلات/ }).click();
    await expect(sheet).toBeHidden();
    expect((await storedCart(page)).items).toEqual([
      cartLineFor(drink, drink.sizes[1], configured.filter((c) => c.optionId !== oat.id), 2), companion,
    ]);
  });
});
