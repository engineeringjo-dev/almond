import { test, expect, type Locator, type Page } from '@playwright/test';
import { cartLineFor, computeTotals } from '@almond/shared/cart';
import { config } from '@almond/shared/config';
import { formatJOD } from '@almond/shared/lib/format';
import { contactLinks } from '@almond/shared/lib/phone';
import { campaignAccessibleLabel } from '../../almond-app/lib/campaignSlides';
import { menuItems } from '@almond/shared/menu/seed';
import type { CartItem, Lang } from '@almond/shared/types';
import ar from '../../almond-app/locales/ar.json';
import en from '../../almond-app/locales/en.json';
import { blockingViolations } from '../fixtures';
import { appUrl, LATTE, seedApp } from './helpers';

const words = { ar, en };
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fill = (value: string, params: Record<string, string | number>) => value.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key]));
const ORDINARY_DAY = '2026-10-20T12:00:00+03:00';

async function storedItems(page: Page): Promise<CartItem[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('almond.cart') ?? '{}').state?.items ?? []);
}

async function home(page: Page, lang: Lang, items: CartItem[] = []): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date(ORDINARY_DAY) });
  await page.clock.resume();
  await seedApp(page, { signedIn: true, lang });
  // This journey concerns the shipped artwork and navigation. Retain the
  // bundled menu so an unrelated live feed change cannot replace its lead photo.
  await page.route('**/api/menu/app', (route) => route.fulfill({ status: 304 }));
  await page.addInitScript(({ lines }) => {
    if (sessionStorage.getItem('e2e.campaign.seeded')) return;
    sessionStorage.setItem('e2e.campaign.seeded', '1');
    localStorage.setItem('almond.cart', JSON.stringify({ version: 1, state: {
      items: lines, orderType: lines.length ? 'pickup' : 'dinein', branchId: 'rabyeh',
      branchNames: { nameAr: 'الرابية', nameEn: 'Rabyeh' }, paymentMethod: 'cash', paidFromBalance: false,
    } }));
  }, { lines: items });
  await page.goto(appUrl('/'));
  const title = items.length ? words[lang].home.continueOrder : words[lang].home.quickOrder;
  await expect(page.getByRole('button', { name: new RegExp(`^${escape(title)}`) })).toBeVisible({ timeout: 20_000 });
}

/** Start from the actual randomly selected card. No production test flag or
 * assumption that Home opens at the first card. */
async function campaignPosition(page: Page): Promise<{ current: number; total: number }> {
  const position = page.getByTestId('home-campaign-position');
  await expect(position).toBeVisible();
  const digits = (await position.textContent())?.match(/\d+/g);
  if (!digits || digits.length !== 2) throw new Error('Campaign position must expose current and total');
  return { current: Number(digits[0]), total: Number(digits[1]) };
}

async function selectCampaign(page: Page, lang: Lang, target: number): Promise<void> {
  const carousel = page.getByTestId('home-campaign-carousel');
  const { current, total } = await campaignPosition(page);
  expect(current).toBeGreaterThanOrEqual(1);
  expect(current).toBeLessThanOrEqual(total);
  expect(total).toBe(7);
  for (let step = 0; step < (target - current + total) % total; step++) {
    await carousel.getByRole('button', { name: words[lang].common.next, exact: true }).click();
  }
  await expect(page.getByTestId('home-campaign-position')).toHaveText(fill(words[lang].campaignSlides.position, { current: target, total }));
}

async function expectNeighbourPeeks(page: Page): Promise<void> {
  const track = page.getByTestId('home-campaign-track');
  await track.scrollIntoViewIfNeeded();
  // Measure actual adjacent photo planes, including the visual-only end copies.
  await expect.poll(() => track.evaluate((node) => {
    const viewport = node.getBoundingClientRect();
    const pages = Array.from(node.querySelectorAll<HTMLElement>('[data-testid^="campaign-slide-"], [data-testid^="campaign-clone-"]'));
    const active = pages.findIndex((page) => page.getAttribute('aria-hidden') !== 'true');
    return [pages[active - 1], pages[active + 1]].map((page) => {
      const photo = page?.querySelector('img')?.getBoundingClientRect();
      return photo ? Math.round(Math.max(0, Math.min(photo.right, viewport.right) - Math.max(photo.left, viewport.left))) : 0;
    });
  })).toEqual([20, 20]);
  await expect(track.getByRole('button')).toHaveCount(1);
  for (const clone of await track.getByTestId(/^campaign-clone-/).all()) {
    await expect(clone).toHaveAttribute('aria-hidden', 'true');
    await expect(clone.getByRole('button', { includeHidden: true })).toHaveCount(0);
  }
}

/** Real browser touch input: CSS snapping and event-driven web settlement must
 * agree with the logical index, not just the Previous/Next button handler. */
async function swipeCampaign(page: Page, lang: Lang): Promise<void> {
  const track = page.getByTestId('home-campaign-track');
  await track.scrollIntoViewIfNeeded();
  const box = await track.boundingBox();
  if (!box) throw new Error('The campaign scroll track has no layout');
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const from = box.x + box.width * (lang === 'ar' ? 0.2 : 0.8);
  const to = box.x + box.width * (lang === 'ar' ? 0.8 : 0.2);
  const y = box.y + Math.min(84, box.height / 4);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] });
  for (let step = 1; step <= 12; step++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from + (to - from) * step / 12, y }] });
    await page.waitForTimeout(25);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

/** React Native Web draws an Image as a background plus a transparent img.
 * Check the actual downloaded image and its contain plane, not its ARIA role. */
async function bundledPhoto(scope: Locator, filename: string): Promise<Locator> {
  const photo = scope.locator(`img[src*="${filename}"]`);
  await expect(photo).toHaveCount(1);
  await expect.poll(() => photo.evaluate((node) => {
    const image = node as HTMLImageElement;
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  }), { message: `${filename} should load from the exported app` }).toBe(true);
  const source = new URL(await photo.getAttribute('src') ?? '', appUrl('/'));
  expect(source.origin).toBe(new URL(appUrl('/')).origin);
  expect(source.pathname).toContain('/almond/');
  const plane = await photo.evaluate((node) => {
    const parent = node.parentElement;
    const displayed = Array.from(parent?.querySelectorAll<HTMLElement>('*') ?? [])
      .find((element) => getComputedStyle(element).backgroundImage !== 'none');
    return displayed ? getComputedStyle(displayed).backgroundSize : null;
  });
  expect(plane, `${filename} must be shown whole`).toBe('contain');
  return photo;
}

for (const lang of ['ar', 'en'] as const) {
  test(`App campaigns (${lang}): a finger swipe advances to the gift card, keeps inactive actions out of focus, and survives resize`, async ({ page }) => {
    await home(page, lang);
    const copy = words[lang];
    const carousel = page.getByTestId('home-campaign-carousel');
    const track = page.getByTestId('home-campaign-track');
    await selectCampaign(page, lang, 1);
    await expect(carousel.getByText(fill(copy.campaignSlides.position, { current: 1, total: 7 }), { exact: true })).toBeVisible();
    await expect(track.getByRole('button')).toHaveCount(1);
    await swipeCampaign(page, lang);
    await expect(carousel.getByText(fill(copy.campaignSlides.position, { current: 2, total: 7 }), { exact: true })).toBeVisible();
    await expectNeighbourPeeks(page);
    const gift = track.getByRole('button', { name: campaignAccessibleLabel(copy.campaignSlides.giftTitle, copy.campaignSlides.giftBody, copy.campaignSlides.giftAction), exact: true });
    await expect(gift).toBeVisible();
    await expect(track.getByRole('button')).toHaveCount(1);
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: viewport.width + 24, height: viewport.height });
    await expect(gift).toBeVisible();
    await expect(carousel.getByText(fill(copy.campaignSlides.position, { current: 2, total: 7 }), { exact: true })).toBeVisible();
    await expectNeighbourPeeks(page);
    await carousel.getByRole('button', { name: copy.common.next, exact: true }).click();
    const walletName = campaignAccessibleLabel(fill(copy.campaignSlides.walletTitle, { extra: 50 }), copy.campaignSlides.walletBody, copy.campaignSlides.walletAction, copy.campaignSlides.walletExclusions);
    await expect(track.getByRole('button', { name: walletName, exact: true })).toBeVisible();
    await carousel.getByRole('button', { name: copy.common.previous, exact: true }).click();
    await gift.click();
    await expect(page).toHaveURL(/\/profile\/gift-cards$/);
    expect(await storedItems(page)).toEqual([]);
  });

  const copy = words[lang];

  test(`App campaigns (${lang}): the bundled cup opens pickup ordering without creating a basket`, async ({ page }) => {
    await home(page, lang);
    const order = page.getByRole('button', { name: new RegExp(`^${escape(copy.home.quickOrder)}`) });
    await bundledPhoto(order, 'almond-iced-cup');
    expect(await storedItems(page)).toEqual([]);
    await order.click();
    const chooser = page.getByRole('dialog', { name: copy.orderType.choose });
    await expect(chooser).toBeVisible();
    await expect(chooser.getByText(copy.orderType.delivery, { exact: true })).toBeVisible();
    expect(await storedItems(page)).toEqual([]);
    // The existing pickup choice is a Pressable row, named by its text.
    await chooser.getByText(copy.orderType.pickup, { exact: true }).click();
    await expect(chooser).toBeHidden();
    await expect(page).toHaveURL(/\/order$/);
    await expect(page.getByRole('textbox', { name: copy.menu.searchPlaceholder })).toBeVisible();
    expect(await storedItems(page)).toEqual([]);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('almond.cart') ?? '{}').state.orderType)).toBe('pickup');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test(`App campaigns (${lang}): four photographed examples disclose the real points terms, then let the customer choose`, async ({ page }) => {
    await home(page, lang);
    await selectCampaign(page, lang, 1);
    const offer = page.getByRole('button', { name: `${copy.campaign.comboName}. ${copy.campaign.viewCombos}`, exact: true });
    await expect(offer.getByText(copy.campaign.comboEligibility, { exact: true })).toBeVisible();
    const expectedBadge = `Cash back\n${config.COMBO_BONUS_POINTS} points`;
    const homeBadge = offer.getByText(expectedBadge, { exact: true });
    expect(await homeBadge.textContent()).toBe(expectedBadge);
    await offer.click();
    await expect(page).toHaveURL(/\/campaigns$/);
    const section = page.getByRole('heading', { name: copy.campaign.comboName, exact: true }).locator('..');
    await expect(section).toBeVisible();
    const { blocking, summary: accessibility } = await blockingViolations(page);
    await test.info().attach(`axe-campaigns-${lang}.json`, {
      body: JSON.stringify(accessibility, null, 2), contentType: 'application/json',
    });
    expect(blocking.map((violation) => `${violation.id} ×${violation.nodes.length}`)).toEqual([]);
    const summary = section.getByText(fill(copy.campaign.comboSummary, { points: config.COMBO_BONUS_POINTS }), { exact: true });
    await expect(summary).toContainText(lang === 'ar' ? 'بدل نقاط الصنفين العادية' : 'instead of those items’ usual points');
    const qualification = section.getByText(copy.campaign.exampleNote, { exact: true });
    await expect(qualification).toContainText(lang === 'ar' ? 'الأصناف المؤهلة' : 'eligible menu items');
    const offerTerms = section.getByText(fill(copy.offers.comboBody, { points: config.COMBO_BONUS_POINTS }), { exact: true });
    await expect(offerTerms).toContainText(lang === 'ar' ? 'تدفع سعر الصنفين كاملاً' : 'You pay the full price of both');
    const pointsTerms = section.getByText(copy.campaign.pointsNote, { exact: true });
    await pointsTerms.scrollIntoViewIfNeeded();
    await expect(pointsTerms).toBeInViewport();
    await expect(pointsTerms).toContainText(lang === 'ar' ? 'مرة واحدة لكل فاتورة' : 'Once per invoice');
    await expect(pointsTerms).toContainText(lang === 'ar' ? 'ليست مبلغاً نقدياً أو رصيد محفظة' : 'not cash or wallet credit');

    const examples = [
      { caption: copy.campaign.comboCookie, file: 'combo-americano-cookie' },
      { caption: copy.campaign.comboCroissant, file: 'combo-americano-croissant' },
      { caption: copy.campaign.comboEggBagel, file: 'combo-americano-egg-bagel' },
      { caption: copy.campaign.comboCheeseBagel, file: 'combo-americano-cheese-bagel' },
    ];
    await expect(section.getByText(expectedBadge, { exact: true })).toHaveCount(4);
    const imageSources: string[] = [];
    for (const example of examples) {
      const card = section.getByText(example.caption, { exact: true }).locator('..');
      await card.scrollIntoViewIfNeeded();
      const photo = await bundledPhoto(card, example.file);
      imageSources.push(await photo.getAttribute('src') ?? '');
      const badge = card.getByText(expectedBadge, { exact: true });
      await expect(badge).toBeInViewport();
      // TextContent preserves the owner-approved explicit newline; Playwright's
      // usual string matcher deliberately normalizes it away.
      expect(await badge.textContent()).toBe(expectedBadge);
      expect(await badge.evaluate((node) => getComputedStyle(node).direction)).toBe('ltr');
    }
    expect(new Set(imageSources).size).toBe(4);
    expect(await storedItems(page)).toEqual([]);
    const menu = section.getByRole('button', { name: copy.campaign.chooseCombo, exact: true });
    await expect(menu).toHaveCount(2);
    // Exercise both repeated entry points across the bilingual runs.
    await menu.nth(lang === 'ar' ? 0 : 1).click();
    await expect(page).toHaveURL(/\/order$/);
    await expect(page.getByRole('textbox', { name: copy.menu.searchPlaceholder })).toBeVisible();
    expect(await storedItems(page)).toEqual([]);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

test('App campaigns: catering reaches the real contact controls without launching an external action', async ({ page }) => {
  await home(page, 'ar');
  await selectCampaign(page, 'ar', 1);
  const carousel = page.getByTestId('home-campaign-carousel');
  for (let step = 0; step < 3; step++) await carousel.getByRole('button', { name: ar.common.next, exact: true }).click();
  await expect(carousel.getByText(fill(ar.campaignSlides.position, { current: 4, total: 7 }), { exact: true })).toBeVisible();
  await carousel.getByRole('button', { name: campaignAccessibleLabel(ar.campaignSlides.cateringTitle, ar.campaignSlides.cateringBody, ar.campaignSlides.cateringAction), exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/help$/);
  await expect(page.getByText(ar.help.heading, { exact: true })).toBeVisible();
  const contact = contactLinks(config.CONTACT_PHONE_E164);
  for (const label of [ar.help.whatsapp, ar.help.call]) {
    const control = page.getByRole('button', { name: new RegExp(`^${escape(label)}`) });
    await expect(control).toBeVisible();
    await expect(control).toBeEnabled();
    await expect(control).toContainText(contact.display);
    await expect(control).not.toContainText('000 0000');
  }
  for (const label of [ar.help.email, ar.help.website]) {
    const control = page.getByRole('button', { name: label, exact: true });
    await expect(control).toBeVisible();
    await expect(control).toBeEnabled();
  }
  // Stop here: these controls launch phone, WhatsApp, mail or browser apps.
  expect(page.context().pages()).toHaveLength(1);
  expect(await storedItems(page)).toEqual([]);
});

for (const lang of ['ar', 'en'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`App campaigns (${lang}, ${theme}): 320px real bilateral peeks survive circular finger wrap and rapid Next`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.emulateMedia({ colorScheme: theme });
      await home(page, lang);
      const carousel = page.getByTestId('home-campaign-carousel');
      // Both logical ends must retain real neighbours rather than blank gutters.
      for (const target of [1, 7]) {
        await selectCampaign(page, lang, target);
        await expectNeighbourPeeks(page);
      }
      await swipeCampaign(page, lang);
      await expect(page.getByTestId('home-campaign-position')).toHaveText(fill(words[lang].campaignSlides.position, { current: 1, total: 7 }));
      await expectNeighbourPeeks(page);
      // Latest button intent wins even when requests cross the circular edge.
      await selectCampaign(page, lang, 6);
      for (let tap = 0; tap < 3; tap++) await carousel.getByRole('button', { name: words[lang].common.next, exact: true }).click();
      await expect(page.getByTestId('home-campaign-position')).toHaveText(fill(words[lang].campaignSlides.position, { current: 2, total: 7 }));
      await expectNeighbourPeeks(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await storedItems(page)).toEqual([]);
    });
  }
}

test('App campaigns: only a fresh Home focus chooses another opening card', async ({ page }) => {
  await home(page, 'ar');
  await selectCampaign(page, 'ar', 2);
  // A bounded test-only RNG makes the next visit deterministic. Changing it
  // inside this visit must not replace the card the member manually selected.
  await page.evaluate(() => { Math.random = () => 0; });
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: viewport.width + 24, height: viewport.height });
  await expect(page.getByTestId('home-campaign-position')).toHaveText(fill(ar.campaignSlides.position, { current: 2, total: 7 }));
  await page.getByRole('tab', { name: ar.tabs.more, exact: true }).click();
  await page.getByRole('tab', { name: ar.tabs.home, exact: true }).click();
  await expect(page.getByTestId('home-campaign-position')).toHaveText(fill(ar.campaignSlides.position, { current: 1, total: 7 }));
  await expectNeighbourPeeks(page);
  await page.evaluate(() => { Math.random = () => 0.999999; });
  await page.getByRole('tab', { name: ar.tabs.more, exact: true }).click();
  await page.getByRole('tab', { name: ar.tabs.home, exact: true }).click();
  await expect(page.getByTestId('home-campaign-position')).toHaveText(fill(ar.campaignSlides.position, { current: 7, total: 7 }));
  await expectNeighbourPeeks(page);
});

test('App campaigns: a nonempty Home order keeps its lead photo, quantity and total and opens the cart', async ({ page }) => {
  const drink = menuItems.find((item) => item.nameAr === LATTE)!;
  const food = menuItems.find((item) => /almond croissant/i.test(item.nameEn))!;
  const items = [cartLineFor(drink, drink.sizes[0], [], 2), cartLineFor(food, food.sizes[0], [], 1)];
  await home(page, 'ar', items);
  const order = page.getByRole('button', { name: new RegExp(`^${escape(ar.home.continueOrder)}`) });
  const subtitle = fill(ar.home.cartLine, { count: 3, total: formatJOD(computeTotals(items, 0).total, 'ar') });
  await expect(order.getByText(subtitle, { exact: true })).toBeVisible();
  await bundledPhoto(order, drink.id);
  await expect(order.locator('img[src*="almond-iced-cup"]')).toHaveCount(0);
  expect(await storedItems(page)).toEqual(items);
  await order.click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole('button', { name: `${ar.cart.edit} ${drink.nameAr}`, exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await storedItems(page)).toEqual(items);
});
