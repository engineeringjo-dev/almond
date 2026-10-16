import { test, expect, type Page } from '@playwright/test';
import { blockingViolations } from '../fixtures';
import { appUrl, seedApp } from './helpers';

/**
 * «المكافآت» IN ONE SCREEN, AND A DOOR TO EACH JOB.
 *
 * Owner, 2026-10-15, after Al Ameed's app: «الصفحة جدا طويلة عندي اريد تقسيمها
 * مثل العميد الى حد ما». The tab was 1,641 pt; a member now gets the card, one
 * row of amounts, the headline and four tiles above the tab bar (94 pt, so the
 * last tile ends by 750), on an ordinary day and on a double-points day, when a
 * line sits above the card. The tiers, the history and the coupons are pages
 * of their own; «كيف تعمل؟» is a sheet. The plan and the before/after numbers:
 * docs/competitors/AL-AMEED-PAGE-DIVISION-2026-10.ar.md.
 *
 * The mock seeds 1,240 points; the clock is pinned so the double day is a day
 * of config.DOUBLE_POINTS_DAYS and the ordinary one is not.
 */
const ORDINARY_DAY = '2026-10-20T12:00:00+03:00';
const EID_AL_FITR = '2027-03-10T12:00:00+03:00';
const TAB_BAR_TOP = 750;
const SCREEN = 844;
const TILE_NAMES = ['سجل النقاط', 'قسائمي', 'فئتك', 'كيف تعمل؟'];

/** The visible scroller with the largest clientHeight; on a tie, the one that
 *  actually scrolls (a wrapper and the scroller inside it share a height). */
async function scrollHeight(page: Page): Promise<number> {
  return page.evaluate(() => {
    let best: HTMLElement | null = null;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
      const s = getComputedStyle(el);
      if (!/(auto|scroll)/.test(s.overflowY) || el.clientHeight === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.bottom <= 0 || r.top >= innerHeight) continue;
      if (!best || el.clientHeight > best.clientHeight
        || (el.clientHeight === best.clientHeight && el.scrollHeight > best.scrollHeight)) best = el;
    }
    return best ? best.scrollHeight : document.documentElement.scrollHeight;
  });
}

async function bottom(page: Page, selector: ReturnType<Page['locator']>): Promise<number> {
  const box = await selector.boundingBox();
  if (!box) throw new Error('not laid out');
  return box.y + box.height;
}

async function openHub(page: Page, at: string): Promise<void> {
  await page.clock.install({ time: new Date(at) });
  await page.clock.resume();
  await seedApp(page, { signedIn: true, lang: 'ar' });
  await page.goto(appUrl('/rewards'));
  await expect(page.getByTestId('rewards-tile')).toHaveCount(4, { timeout: 20_000 });
}

test.describe('App: the Rewards tab is one screen', () => {
  test('an ordinary day: the card, the amounts and the four doors, without scrolling', async ({ page }) => {
    await openHub(page, ORDINARY_DAY);
    const tiles = page.getByTestId('rewards-tile');
    // In reading order: the history, the coupons, the tier, how it works.
    for (const [i, name] of TILE_NAMES.entries()) {
      await expect(tiles.nth(i)).toContainText(name);
    }
    await expect(page.getByText(/^نقاط مضاعفة اليوم/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'استبدل 100 من نقاطك بقسيمة بقيمة 1.00 د.أ', exact: true })).toBeInViewport();
    expect(await bottom(page, tiles.last())).toBeLessThanOrEqual(TAB_BAR_TOP);
    expect(await scrollHeight(page)).toBeLessThanOrEqual(SCREEN);

    const { blocking } = await blockingViolations(page);
    expect(blocking, 'the Rewards hub must pass axe').toEqual([]);
  });

  test('a double-points day: the line above the card, and still no scrolling', async ({ page }) => {
    await openHub(page, EID_AL_FITR);
    await expect(page.getByText('نقاط مضاعفة اليوم بمناسبة عيد الفطر')).toBeVisible();
    expect(await bottom(page, page.getByTestId('rewards-tile').last())).toBeLessThanOrEqual(TAB_BAR_TOP);
    expect(await scrollHeight(page)).toBeLessThanOrEqual(SCREEN);
  });

  test('each door opens its page, and «رجوع» comes back', async ({ page }) => {
    await openHub(page, ORDINARY_DAY);
    const tiles = page.getByTestId('rewards-tile');
    const doors: { tile: number; path: RegExp; shows: string }[] = [
      { tile: 0, path: /\/loyalty$/, shows: 'نقاط استبدلتها' },
      { tile: 1, path: /\/vouchers$/, shows: 'لا توجد قسائم نشطة' },
      { tile: 2, path: /\/tiers$/, shows: 'فئتك الحالية' },
    ];
    // The stack keeps the screens under the top one in the page, hidden, so
    // each lookup is of what is on screen.
    for (const d of doors) {
      await tiles.nth(d.tile).click();
      await expect(page).toHaveURL(d.path);
      await expect(page.getByText(d.shows, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await page.getByRole('button', { name: 'رجوع' }).filter({ visible: true }).last().click();
      await expect(page).toHaveURL(/\/rewards$/);
      await expect(tiles.filter({ visible: true })).toHaveCount(4);
    }
    // «كيف تعمل؟» is a sheet over the hub, not a page.
    await tiles.nth(3).click();
    const sheet = page.getByRole('dialog', { name: 'كيف تعمل المكافآت؟' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('اطلب واجمع');
    await expect(sheet).toContainText('نقاط مضاعفة في رمضان والأعياد والعطل الرسمية');
    await sheet.getByRole('button', { name: 'إغلاق' }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/rewards$/);
  });

  test('the old address of «قسائمي» lands on the new page', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'ar' });
    await page.goto(appUrl('/profile/vouchers'));
    await expect(page).toHaveURL(/\/vouchers$/, { timeout: 20_000 });
    await expect(page.getByText('لا توجد قسائم نشطة')).toBeVisible();
  });
});

test.describe('App: «فئتك ومزاياك» is one screen', () => {
  test('the ladder, the three rungs and the double days, without scrolling', async ({ page }) => {
    await seedApp(page, { signedIn: true, lang: 'ar' });
    await page.goto(appUrl('/tiers'));
    await expect(page.getByText('فئتك الحالية')).toBeVisible({ timeout: 20_000 });
    for (const line of ['من هنا يبدأ الجميع', '4 زيارات خلال آخر 3 أشهر', 'أعلى فئة لدينا']) {
      await expect(page.getByText(line, { exact: true })).toBeInViewport();
    }
    const doubleDays = page.getByText('نقاط مضاعفة في رمضان والأعياد والعطل الرسمية');
    expect(await bottom(page, doubleDays)).toBeLessThanOrEqual(SCREEN);
    expect(await scrollHeight(page)).toBeLessThanOrEqual(SCREEN);

    const { blocking } = await blockingViolations(page);
    expect(blocking, '/tiers must pass axe').toEqual([]);
  });
});

test.describe('App: Rewards for a guest', () => {
  test('sign-in first, without scrolling, and again at the end', async ({ page }) => {
    await seedApp(page, { lang: 'ar' });
    await page.goto(appUrl('/rewards'));
    const login = page.getByRole('button', { name: 'تسجيل الدخول' });
    await expect(login).toHaveCount(2, { timeout: 20_000 });
    expect(await bottom(page, login.first())).toBeLessThanOrEqual(400);
    // What the programme pays and how it works, but no balance and no amounts.
    await expect(page.getByText('كاش باك لغاية 9%')).toBeVisible();
    await expect(page.getByText('استبدل نقاطك')).toHaveCount(0);
    await expect(page.getByTestId('rewards-tile')).toHaveCount(0);
    expect(await scrollHeight(page)).toBeLessThanOrEqual(1641);

    const { blocking } = await blockingViolations(page);
    expect(blocking, 'the guest Rewards page must pass axe').toEqual([]);

    await login.first().click();
    await expect(page).toHaveURL(/\/login/);
  });
});
