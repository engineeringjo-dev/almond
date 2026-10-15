import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseMeBalance, toLoyaltyBalance } from '@almond/shared/loyalty/balanceWire';
import { mockLoyaltyService } from '@/services/loyalty.service.mock';
import { SHIPPED_WELCOME_BONUS_POINTS, setWelcomeGift } from '../../packages/shared/test-setup/no-welcome-gift';

/**
 * WA1-WA3 — the welcome gift in the app (owner, 2026-10-15: «امنح ٢٠٠ نقطة
 * تفعل بعد اول عملية شراء وتنزيل نقاط عالتطبيق»). The server's half is WG1-WG3
 * and T37; this holds the mock to the same rule and the screens to the count
 * the server sends.
 */
describe('WA1 the mock pays it as the server does', () => {
  beforeAll(() => setWelcomeGift(SHIPPED_WELCOME_BONUS_POINTS));
  afterAll(() => setWelcomeGift(0));

  it('shown before the first order, not held; the first paid order makes it theirs, once', async () => {
    const id = `wa-${Math.random().toString(36).slice(2)}`;
    const before = await mockLoyaltyService.getBalance(id);
    expect(before.welcomeBonusPending).toBe(SHIPPED_WELCOME_BONUS_POINTS);

    const { pointsEarned } = await mockLoyaltyService.earn({ userId: id, invoiceAmount: 10, paidFromBalance: false });
    const after = await mockLoyaltyService.getBalance(id);
    expect(after.welcomeBonusPending).toBe(0);
    expect(after.points).toBe(before.points + pointsEarned + SHIPPED_WELCOME_BONUS_POINTS);
    const lines = (await mockLoyaltyService.getHistory(id)).filter((h) => h.reasonEn === 'Welcome gift');
    expect(lines).toEqual([expect.objectContaining({ deltaPoints: SHIPPED_WELCOME_BONUS_POINTS, kind: 'bonus' })]);

    await mockLoyaltyService.earn({ userId: id, invoiceAmount: 10, paidFromBalance: false });
    expect((await mockLoyaltyService.getHistory(id)).filter((h) => h.reasonEn === 'Welcome gift')).toHaveLength(1);
  });
});

describe('WA2 the live client carries the server\'s count to the screen', () => {
  it('through the wire and into LoyaltyBalance', () => {
    const wire = parseMeBalance({
      points: 0, windowSpend: 0, visitDays: 0,
      tier: { id: 'base', nameAr: '2%', nameEn: '2%', multiplier: 1 },
      nextTier: null, nextExpiry: null, welcomeBonusPending: 200,
    });
    expect(toLoyaltyBalance(wire, 'u').welcomeBonusPending).toBe(200);
  });
});

describe('WA3 the wiring', () => {
  const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');
  it('Home\'s card and the rewards hero both state the server\'s count', () => {
    expect(src('components/home/LoyaltyCard.tsx')).toMatch(/<WelcomeGiftNote points=\{data\.welcomeBonusPending\} \/>/);
    expect(src('app/(tabs)/rewards.tsx')).toMatch(/<WelcomeGiftNote points=\{balance\.welcomeBonusPending\} \/>/);
  });
  it('the note says nothing at 0 and is never added to the balance it sits beside', () => {
    const note = src('components/loyalty/WelcomeGiftNote.tsx');
    expect(note).toMatch(/if \(!points \|\| points <= 0\) return null;/);
    expect(note).not.toMatch(/points \+/);
  });
});
