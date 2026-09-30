import { test, expect, type Locator, type Page } from '@playwright/test';
import { blockingViolations } from '../fixtures';
import { addLatte, appUrl, LATTE, openItem, seedApp } from './helpers';

/**
 * The customer app's design system on its web build — the P2 findings of the
 * 2026-09-30 audit that live in shared UI: state on every chip, Space on the
 * roles that promise it, a named and closable sheet, 44 px targets, Reduce
 * Motion, one digit system, alignment and logical offsets by the interface's
 * direction, no duplicated names, no orphan /menu, a centred column on wide
 * windows. Mock services, the shipped `expo export` bundle.
 */

async function box(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error('no box');
  return b;
}

/** Translate-Y of `l` and its ancestors up to the dialog (0 = at rest). */
async function translateYChain(l: Locator): Promise<number[]> {
  return l.evaluate((el) => {
    const out: number[] = [];
    for (let n: Element | null = el; n && n.getAttribute('role') !== 'dialog'; n = n.parentElement) {
      const t = getComputedStyle(n).transform;
      if (t && t !== 'none') out.push(new DOMMatrixReadOnly(t).m42);
    }
    return out;
  });
}

test.describe('App design system: selection state reaches the web', () => {
  test('category chips and Order sub-tabs are tablists with one selected tab', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await page.goto(appUrl('/order'));
    const cats = page.getByRole('tablist', { name: 'التصنيفات' });
    await expect(cats.getByRole('tab').first()).toBeVisible({ timeout: 20_000 });
    await expect(cats.getByRole('tab', { selected: true })).toHaveCount(1);
    const second = cats.getByRole('tab').nth(1);
    await second.click();
    await expect(second).toHaveAttribute('aria-selected', 'true');
    await expect(cats.getByRole('tab', { selected: true })).toHaveCount(1);

    const sub = page.getByRole('tablist', { name: 'اطلب' });
    await expect(sub.getByRole('tab', { name: 'القائمة' })).toHaveAttribute('aria-selected', 'true');
    await sub.getByRole('tab', { name: 'المميّز' }).click();
    await expect(sub.getByRole('tab', { name: 'المميّز' })).toHaveAttribute('aria-selected', 'true');
    await expect(sub.getByRole('tab', { selected: true })).toHaveCount(1);
  });

  test('profile gender and transfer kind are named radiogroups of checked radios', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await page.goto(appUrl('/profile/details'));
    const gender = page.getByRole('radiogroup', { name: 'الجنس' });
    await expect(gender.getByRole('radio')).toHaveCount(2, { timeout: 20_000 });
    const male = gender.getByRole('radio', { name: 'ذكر' });
    await male.click();
    await expect(male).toHaveAttribute('aria-checked', 'true');
    await expect(gender.getByRole('radio', { checked: true })).toHaveCount(1);

    await page.goto(appUrl('/transfer'));
    const kind = page.getByRole('radiogroup', { name: 'ماذا ترسل؟' });
    await expect(kind.getByRole('radio', { checked: true })).toHaveCount(1, { timeout: 20_000 });
    const wallet = kind.getByRole('radio', { name: 'رصيد المحفظة' });
    await wallet.click();
    await expect(wallet).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('App design system: Space does what the role promises', () => {
  test('Space checks a size radio and toggles an add-on checkbox, without scrolling', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await openItem(page, LATTE);
    const sheet = page.getByRole('dialog');
    const sizes = sheet.getByRole('radiogroup', { name: 'الحجم' });
    const otherName = (await sizes.getByRole('radio', { checked: false }).first().getAttribute('aria-label')) ?? '';
    const other = sizes.getByRole('radio', { name: otherName, exact: true });
    const scrollTops = () =>
      page.evaluate(() => [...document.querySelectorAll('*')].map((e) => e.scrollTop).reduce((a, b) => a + b, 0));
    const before = await scrollTops();
    await other.focus();
    await page.keyboard.press('Space');
    await expect(other).toHaveAttribute('aria-checked', 'true');
    expect(await scrollTops(), 'Space must not scroll the sheet').toBe(before);

    const extra = sheet.getByRole('group', { name: 'إضافات' }).getByRole('checkbox').first();
    await extra.focus();
    await page.keyboard.press('Space');
    await expect(extra).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Space');
    await expect(extra).toHaveAttribute('aria-checked', 'false');
  });

  test('Space selects a category tab and an Order sub-tab', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await page.goto(appUrl('/order'));
    const tab = page.getByRole('tablist', { name: 'التصنيفات' }).getByRole('tab').nth(1);
    await expect(tab).toBeVisible({ timeout: 20_000 });
    await tab.focus();
    await page.keyboard.press('Space');
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    const featured = page.getByRole('tab', { name: 'المميّز' });
    await featured.focus();
    await page.keyboard.press('Space');
    await expect(featured).toHaveAttribute('aria-selected', 'true');
  });

  test('arrows move within a radiogroup and a tablist, mirrored in Arabic (WAI-ARIA APG)', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await openItem(page, LATTE);
    const sizes = page.getByRole('dialog').getByRole('radiogroup', { name: 'الحجم' });
    const radios = sizes.getByRole('radio');
    const first = radios.nth(0);
    await expect(first).toHaveAttribute('aria-checked', 'true');
    await first.focus();
    await page.keyboard.press('ArrowLeft'); // RTL: left is forward
    await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'true');
    await expect(radios.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(first).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('dialog').getByRole('button', { name: 'إغلاق' }).click();

    await page.getByRole('textbox', { name: 'ابحث عن مشروب أو طبق' }).fill('');
    const tabs = page.getByRole('tablist', { name: 'التصنيفات' }).getByRole('tab');
    await tabs.nth(0).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('App design system: the bottom sheet', () => {
  test('a named dialog with a visible close button', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await openItem(page, LATTE);
    const sheet = page.getByRole('dialog', { name: LATTE });
    await expect(sheet).toBeVisible();
    const close = sheet.getByRole('button', { name: 'إغلاق' });
    const b = await box(close);
    expect(Math.round(b.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(b.height)).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('dragging the header down dismisses; a short slow drag springs back', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await openItem(page, LATTE);
    const close = page.getByRole('dialog').getByRole('button', { name: 'إغلاق' });
    const c = await box(close);
    const x = (page.viewportSize()?.width ?? 390) / 2;
    const y = c.y + c.height / 2;

    // Short and slow: stays open.
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i += 1) {
      await page.mouse.move(x, y + i * 3);
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(600);
    await expect(page.getByRole('dialog')).toBeVisible();

    // Past the distance: dismissed.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 200, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('Reduce Motion: the sheet is at rest the moment it opens; tiles do not rise', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedApp(page, { signedIn: true });
    await page.goto(appUrl('/order'));
    const search = page.getByRole('textbox', { name: 'ابحث عن مشروب أو طبق' });
    await expect(search).toBeVisible({ timeout: 20_000 });
    // The first menu tile's wrappers are fully opaque from the first frame.
    const tile = page.getByRole('button', { name: new RegExp(LATTE) }).first();
    await search.fill(LATTE);
    await expect(tile).toBeVisible();
    const minOpacity = await tile.evaluate((el) => {
      let min = 1;
      for (let n: Element | null = el; n; n = n.parentElement) min = Math.min(min, Number(getComputedStyle(n).opacity));
      return min;
    });
    expect(minOpacity).toBe(1);

    await tile.click();
    const close = page.getByRole('dialog').getByRole('button', { name: 'إغلاق' });
    await expect(close).toBeVisible();
    expect((await translateYChain(close)).every((y) => y === 0), 'no slide under Reduce Motion').toBe(true);
  });
});

test.describe('App design system: targets, digits, direction, names', () => {
  test('controls are at least 44 px tall on the web; the barcode label matches its siblings', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await openItem(page, LATTE);
    const sheet = page.getByRole('dialog');
    const milk = sheet.getByRole('radiogroup').nth(1).getByRole('radio');
    for (let i = 0; i < Math.min(3, await milk.count()); i += 1) {
      expect(Math.round((await box(milk.nth(i))).height), `milk option ${i}`).toBeGreaterThanOrEqual(44);
    }
    const plus = sheet.getByRole('button', { name: 'زيادة الكمية' });
    const p = await box(plus);
    expect(Math.round(Math.min(p.width, p.height))).toBeGreaterThanOrEqual(44);
    await sheet.getByRole('button', { name: 'إغلاق' }).click();

    const cat = page.getByRole('tablist', { name: 'التصنيفات' });
    await page.getByRole('textbox', { name: 'ابحث عن مشروب أو طبق' }).fill('');
    expect(Math.round((await box(cat.getByRole('tab').first())).height)).toBeGreaterThanOrEqual(44);

    const size = (name: string) =>
      page.getByRole('tab', { name }).getByText(name, { exact: true }).evaluate((e) => getComputedStyle(e).fontSize);
    expect(await size('الباركود')).toBe(await size('الرئيسية'));
    expect(parseFloat(await size('الباركود'))).toBeGreaterThanOrEqual(11);
  });

  test('dates print in Latin digits beside Latin prices', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await page.goto(appUrl('/order'));
    await page.getByRole('tab', { name: 'السابقة' }).click();
    await expect(page.getByText(/رقم الطلب/).first()).toBeVisible({ timeout: 20_000 });
    const text = await page.locator('body').innerText();
    const months = 'كانون|شباط|آذار|نيسان|أيار|حزيران|تموز|آب|أيلول|تشرين';
    expect(text).toMatch(new RegExp(`\\d+ (${months})`));
    expect(text).not.toMatch(new RegExp(`[٠-٩]+ (${months})`));
    // Times too («09:07 ص», not «٠٩:٠٧ ص»), wherever one is printed.
    expect(text).not.toMatch(/[٠-٩]{2}:[٠-٩]{2}/);
  });

  test('English text sits at the Arabic reading start; the search field starts right', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'ar' });
    await page.goto(appUrl('/order'));
    const search = page.getByRole('textbox', { name: 'ابحث عن مشروب أو طبق' });
    await expect(search).toBeVisible({ timeout: 20_000 });
    expect(await search.evaluate((e) => getComputedStyle(e).textAlign)).toBe('right');
    await search.fill(LATTE);
    const english = page.getByText('Iced Latte', { exact: true }).first();
    await expect(english).toBeVisible();
    expect(await english.evaluate((e) => getComputedStyle(e).textAlign)).toBe('right');
  });

  test('English UI: text starts left; Arabic names keep their own direction', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'en' });
    await page.goto(appUrl('/order'));
    const search = page.getByRole('textbox', { name: 'Search for a drink or dish' });
    await expect(search).toBeVisible({ timeout: 20_000 });
    expect(await search.evaluate((e) => getComputedStyle(e).textAlign)).toBe('left');
    await search.fill('Iced Latte');
    const arabic = page.getByText(LATTE, { exact: true }).first();
    await expect(arabic).toBeVisible();
    expect(await arabic.evaluate((e) => [getComputedStyle(e).textAlign, getComputedStyle(e).direction])).toEqual([
      'left',
      'rtl',
    ]);
  });

  for (const [lang, name, endIsLeft] of [
    ['ar', 'أضف للمفضّلة', true],
    ['en', 'Add to favourites', false],
  ] as const) {
    test(`logical offsets follow the language (${lang}): the ♥ sits at the reading end`, async ({ page }) => {
      await seedApp(page, { signedIn: true, lang });
      await page.goto(appUrl('/order'));
      const s = page.getByRole('textbox').first();
      await expect(s).toBeVisible({ timeout: 20_000 });
      await s.fill(lang === 'ar' ? LATTE : 'Iced Latte');
      await page.getByText(lang === 'ar' ? LATTE : 'Iced Latte', { exact: true }).first().click();
      const h = await box(page.getByRole('dialog').getByRole('button', { name }));
      const mid = (page.viewportSize()?.width ?? 390) / 2;
      expect(h.x + h.width / 2 < mid, `♥ on the ${endIsLeft ? 'left' : 'right'}`).toBe(endIsLeft);
    });
  }

  test('an untranslated item prints its name once; rows draw a chevron icon', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await page.goto(appUrl('/order'));
    const search = page.getByRole('textbox', { name: 'ابحث عن مشروب أو طبق' });
    await expect(search).toBeVisible({ timeout: 20_000 });
    await search.fill('Cortado');
    await expect(page.getByText('Cortado', { exact: true }).first()).toBeVisible();
    const tile = page.getByRole('button').filter({ has: page.getByText('Cortado', { exact: true }) }).first();
    await expect(tile.getByText('Cortado', { exact: true })).toHaveCount(1);

    await page.goto(appUrl('/profile'));
    await expect(page.getByText('بياناتك')).toBeVisible({ timeout: 20_000 });
    expect(await page.locator('body').innerText()).not.toMatch(/[‹›]/);
  });

  test('/menu lands on the Order tab (old links keep working)', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await page.goto(appUrl('/menu'));
    await expect(page).toHaveURL(/\/almond\/order$/);
    await expect(page.getByRole('tab', { name: 'القائمة', selected: true })).toBeVisible();
  });
});

test.describe('App design system: wide windows', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  const centred = (b: { x: number; width: number }, page: Page) =>
    Math.abs(b.x + b.width / 2 - (page.viewportSize()?.width ?? 1024) / 2);

  test('menu, sheet and cart stop at a readable width, centred', async ({ page }) => {
    await seedApp(page, { signedIn: true });
    await openItem(page, LATTE);
    const sheetBtn = await box(page.getByRole('dialog').getByRole('button', { name: /أضف للسلة/ }));
    expect(sheetBtn.width).toBeLessThanOrEqual(640);
    expect(centred(sheetBtn, page)).toBeLessThan(2);
    await page.getByRole('dialog').getByRole('button', { name: 'إغلاق' }).click();

    // The Order column: its sub-tab strip spans it edge to edge.
    const column = await box(page.getByRole('tablist', { name: 'اطلب' }));
    expect(column.width).toBeLessThanOrEqual(680);
    expect(centred(column, page)).toBeLessThan(2);

    await addLatte(page);
    await page.goto(appUrl('/cart'));
    const review = page.getByRole('button', { name: /مراجعة الطلب/ });
    await expect(review).toBeVisible({ timeout: 20_000 });
    const r = await box(review);
    expect(r.width).toBeLessThanOrEqual(680);
    expect(centred(r, page)).toBeLessThan(2);
  });
});

test.describe('App design system: axe', () => {
  for (const [label, go] of [
    ['menu', async (page: Page) => { await page.goto(appUrl('/order')); await expect(page.getByRole('tablist', { name: 'التصنيفات' })).toBeVisible({ timeout: 20_000 }); }],
    ['item sheet', async (page: Page) => { await openItem(page, LATTE); }],
    ['cart', async (page: Page) => { await addLatte(page); await page.goto(appUrl('/cart')); await expect(page.getByRole('button', { name: /مراجعة الطلب/ })).toBeVisible({ timeout: 20_000 }); }],
  ] as const) {
    test(`no serious or critical violations: ${label}`, async ({ page }) => {
      // Measure the settled screen, not an entrance animation. The menu cards
      // fade in (FadeIn, staggered 30ms each over 300ms); on a slow CI runner
      // axe sampled the text mid-fade — semi-transparent over the background —
      // and flagged contrast the finished screen does not have. Reduced motion
      // renders every FadeIn at opacity 1, so axe checks the colours the
      // customer actually reads. Precedent: Deque's axe guidance is to scan a
      // page in a stable state, after animations complete.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await seedApp(page, { signedIn: true });
      await go(page);
      const { blocking, summary } = await blockingViolations(page);
      await test.info().attach(`axe-app-${label}.json`, { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
      expect(blocking.map((v) => `${v.id} ×${v.nodes.length}`)).toEqual([]);
    });
  }
});
