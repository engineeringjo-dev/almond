import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { redeemStep } from '@/lib/redeemSheet';
import { activeVoucherCount, lastPointsMove } from '@/lib/rewardsHub';
import type { PointsLogEntry, Voucher } from '@/types';

/**
 * RH — «المكافآت» IN ONE SCREEN, AND A DOOR TO EACH JOB.
 *
 * Owner, 2026-10-15, after Al Ameed's app: «الصفحة جدا طويلة عندي اريد تقسيمها
 * مثل العميد الى حد ما». The tab was 1,641 pt in seven sections; a member now
 * gets the card, one row of amounts, the headline and four tiles, and the
 * tiers, the history and the coupons are pages of their own. The one-screen
 * measurements are e2e (e2e/app/rewards-hub.spec.ts); this pins the structure
 * they depend on, and the pure parts under the tiles and the sheet.
 */
const APP = join(__dirname, '..');
const code = (rel: string): string =>
  readFileSync(join(APP, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });

const rewards = code('app/(tabs)/rewards.tsx');
const member = rewards.slice(rewards.indexOf('function MemberRewards'), rewards.indexOf('function GuestRewards'));
const guest = rewards.slice(rewards.indexOf('function GuestRewards'), rewards.indexOf('const styles'));

describe('RH1 a member\'s Rewards tab: the card, the amounts, four doors', () => {
  it('the four tiles, in reading order, each to its own place', () => {
    const tiles = [...member.matchAll(
      /<RewardsTile\s+icon="[\w-]+"\s+title=\{t\('([\w.]+)'\)\}\s+subline=\{[^}]*\}\s+onPress=\{\(\) => ([^}]+)\}\s*\/>/g,
    )].map((m) => [m[1], m[2]]);
    expect(tiles).toEqual([
      ['loyalty.history', "router.push('/loyalty')"],
      ['profile.vouchers', "router.push('/vouchers')"],
      ['loyalty.tier', "router.push('/tiers')"],
      ['rewards.tileHow', 'setHowOpen(true)'],
    ]);
    expect(member.match(/<RewardsTile\b/g)).toHaveLength(4);
  });

  it('what moved off the tab is not still on it', () => {
    // The tiers are /tiers, the steps are the sheet, the history is a tile.
    for (const gone of ['<TierCards', '<HowItWorksSteps', 'PeekCarousel', 'BonusDayBanner', 'worthNow']) {
      expect(member, gone).not.toContain(gone);
    }
    expect(member).toContain('<DoubleDayNote />');
    expect(member).toContain('<HowItWorksSheet visible={howOpen}');
  });

  it('the amounts say the money; the points are in their spoken name', () => {
    expect(member).toMatch(/\{o\.full \? t\('rewards\.wholeBalance'\) : jod\}/);
    expect(member).toMatch(/t\('rewards\.redeemAllA11y', \{ jod, points: cost \}\)/);
    expect(member).toMatch(/t\('rewards\.redeemA11y', \{ jod, points: cost \}\)/);
  });
});

describe('RH2 a guest\'s Rewards tab: sign-in first, and again at the end', () => {
  it('who sees which page', () => {
    expect(rewards).toMatch(/return !user \|\| user\.isGuest \? <GuestRewards \/> : <MemberRewards \/>;/);
  });

  it('the headline, sign-in, how it works, the tiers, sign-in', () => {
    const at = (needle: string, from = 0) => {
      const i = guest.indexOf(needle, from);
      expect(i, needle).toBeGreaterThan(-1);
      return i;
    };
    const order = [
      at("t('rewards.headline', range)"),
      at("t('rewards.headlineSub', range)"),
      at("t('auth.loginToContinue')"),
      at('<HowItWorksSteps />'),
      at('<TierCards />'),
      guest.lastIndexOf("t('auth.loginToContinue')"),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(guest.match(/t\('auth\.loginToContinue'\)/g)).toHaveLength(2);
    expect(guest).not.toMatch(/redeemOptions|BalanceWorth|RewardsTile/);
  });

  it('and signing in brings the member back to it', () => {
    expect(guest).toMatch(/params: \{ returnTo: '\/rewards' \}/);
    expect(code('app/tiers.tsx')).toMatch(/params: \{ returnTo: '\/tiers' \}/);
  });
});

describe('RH3 the redeem sheet: asked, waiting, done, failed', () => {
  const m = (isPending: boolean, isSuccess: boolean, isError: boolean) => ({ isPending, isSuccess, isError });
  it('one step for each state of the one redemption', () => {
    expect(redeemStep(m(false, false, false))).toBe('confirm');
    expect(redeemStep(m(true, false, false))).toBe('pending');
    expect(redeemStep(m(false, true, false))).toBe('done');
    expect(redeemStep(m(false, false, true))).toBe('failed');
  });

  it('a retry in flight is waiting, not still failed', () => {
    expect(redeemStep(m(true, false, true))).toBe('pending');
  });

  it('a failure says so and offers the same button again', () => {
    const sheet = code('components/loyalty/RedeemSheet.tsx');
    expect(sheet).toMatch(/step === 'failed' \? t\('common\.retry'\) : t\('rewards\.redeemCta'\)/);
    expect(sheet).toMatch(/\{step === 'failed' \? \(\s*<Text[^>]*accessibilityRole="alert">\s*\{t\('rewards\.redeemFailed'\)\}/);
    // The next step identifies the voucher returned by this redemption.
    expect(sheet).toContain("const destination: Href = { pathname: '/vouchers', params: issued ? { voucherId: issued.id } : undefined };");
    expect(sheet).toContain('onDismiss={finishVoucherNavigation}');
  });
});

describe('RH4 the numbers under the tiles', () => {
  const line = (createdAt: string, kind: PointsLogEntry['kind'], deltaPoints = 10): PointsLogEntry => ({
    id: createdAt, deltaPoints, reasonAr: 'س', reasonEn: 'r', createdAt, kind,
  });

  it('the last movement is the newest points line, whatever order it came in', () => {
    const history = [
      line('2026-10-01T09:00:00Z', 'bonus'),
      line('2026-10-09T09:00:00Z', 'purchase'),
      // The wallet's money lines are the wallet's own statement.
      line('2026-10-13T09:00:00Z', 'wallet'),
      line('2026-10-05T09:00:00Z', 'redeem', -100),
    ];
    expect(lastPointsMove(history)?.createdAt).toBe('2026-10-09T09:00:00Z');
    expect(lastPointsMove([])).toBeNull();
    expect(lastPointsMove([line('2026-10-13T09:00:00Z', 'wallet')])).toBeNull();
  });

  it('a coupon counts while it can still be used', () => {
    const now = new Date('2026-10-16T12:00:00Z');
    const v = (id: string, expiresAt: string, used?: boolean): Voucher => ({
      id, titleAr: 'خصم', titleEn: 'Off', type: 'credit', value: 1, expiresAt, used,
    });
    expect(activeVoucherCount([
      v('live', '2026-11-15T00:00:00Z'),
      v('used', '2026-11-15T00:00:00Z', true),
      v('past', '2026-10-15T00:00:00Z'),
    ], now)).toBe(1);
    expect(activeVoucherCount([], now)).toBe(0);
  });
});

describe('RH5 the double day reaches the tab', () => {
  it('a line from the server\'s calendar, and nothing on any other day', () => {
    const note = code('components/loyalty/DoubleDayNote.tsx');
    expect(note).toMatch(/import \{ activeDoubleDay \} from '@almond\/shared\/loyalty\/earn';/);
    expect(note).toMatch(/const today = activeDoubleDay\(\);\s*if \(!today\) return null;/);
  });

  it('the banner that read the retired weekday is gone, and nothing reaches for it', () => {
    expect(existsSync(join(APP, 'components/loyalty/BonusDayBanner.tsx'))).toBe(false);
    const users = [...walk(join(APP, 'app')), ...walk(join(APP, 'components'))]
      .filter((f) => /BonusDayBanner/.test(code(relative(APP, f))));
    expect(users).toEqual([]);
  });
});

describe('RH6 the doors are pages, and «قسائمي» has one address', () => {
  it('/tiers and /vouchers are stack screens', () => {
    const layout = code('app/_layout.tsx');
    expect(layout).toContain('<Stack.Screen name="tiers" />');
    expect(layout).toContain('<Stack.Screen name="vouchers" />');
  });

  it('the old address redirects, and nothing links to it any more', () => {
    expect(code('app/profile/vouchers.tsx')).toMatch(/return <Redirect href="\/vouchers" \/>;/);
    const linkers = [...walk(join(APP, 'app')), ...walk(join(APP, 'components'))]
      .filter((f) => /['"]\/profile\/vouchers['"]/.test(code(relative(APP, f))))
      .map((f) => relative(APP, f));
    expect(linkers).toEqual([]);
  });

  it('«المزيد» lists it no more, in three groups and the account card', () => {
    const more = code('app/(tabs)/profile.tsx');
    expect(more).not.toContain("t('profile.vouchers')");
    expect(more.match(/<Card padded=\{false\} style=\{styles\.menu\}>/g)).toHaveLength(4);
  });

  it('the history is the history: titled so, without the tier or the coupons', () => {
    const history = code('app/loyalty.tsx');
    expect(history.match(/title: t\('loyalty\.history'\)/g)).toHaveLength(2);
    expect(history).not.toMatch(/TierProgress|VoucherCard|useVouchers|HeroCard/);
  });
});

describe('RH7 the other screens the split touched', () => {
  it('the barcode tab has no «سجل النقاط» link that opened the Rewards tab', () => {
    const pay = code('app/(tabs)/pay.tsx');
    expect(pay).not.toMatch(/pay\.history|historyLink/);
  });

  it('notifications: the inbox before its settings', () => {
    const n = code('app/notifications.tsx');
    expect(n.indexOf("t('notifications.inbox')")).toBeGreaterThan(-1);
    expect(n.indexOf("t('notifications.inbox')")).toBeLessThan(n.indexOf("t('notifications.settings')"));
  });

  it('the switch is the ink when on, on the web too', () => {
    const toggle = code('components/ui/Toggle.tsx');
    expect(toggle).toContain('trackColor={{ false: colors.outline, true: colors.primary }}');
    expect(toggle).toContain('activeThumbColor={colors.onInk}');
    expect(toggle).not.toMatch(/colors\.green|colors\.warmGray/);
  });
});
