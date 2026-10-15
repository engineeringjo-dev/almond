import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { config } from '@/constants/config';
import { mockLoyaltyService } from '@/services/loyalty.service.mock';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';

/**
 * DA1-DA3 — account deletion in the app (owner, 2026-10-15: «اضف حذف الحساب»,
 * «مهلة تراجع قبل الحذف نعم», «عند الحذف يبقى الرصيد مربوط بالمعلومات ورقم
 * الهاتف», «النقاط لا تسقط الا بالموعدها»). The server's half: AD1-AD2 and T37.
 */
const DAY = 86_400_000;

describe('DA1 the mock keeps the server\'s rule', () => {
  it('ask → a date the grace period away; ask again → the same; withdraw → none', async () => {
    const id = `da-${Math.random().toString(36).slice(2)}`;
    expect(await mockLoyaltyService.getDeletion(id)).toBeNull();
    const d = await mockLoyaltyService.requestDeletion(id);
    expect(Date.parse(d.eraseAfter) - Date.parse(d.requestedAt)).toBe(config.ACCOUNT_DELETION_GRACE_DAYS * DAY);
    expect(await mockLoyaltyService.requestDeletion(id)).toEqual(d);
    expect(await mockLoyaltyService.cancelDeletion(id)).toBe(true);
    expect(await mockLoyaltyService.cancelDeletion(id)).toBe(false);
    expect(await mockLoyaltyService.getDeletion(id)).toBeNull();
  });
});

describe('DA2 what the screen promises is what the server does', () => {
  it('says the balance stays with the number and expires only on its own dates, and names what goes', () => {
    expect(ar.deleteAccount.staysBody).toMatch(/نقاطك ورصيد محفظتك/);
    expect(ar.deleteAccount.staysBody).toMatch(/وتنتهي في مواعيدها فقط/);
    expect(ar.deleteAccount.staysBody).toMatch(/طلباتك وفواتيرك السابقة/);
    expect(ar.deleteAccount.goesBody).toMatch(/اسمك وتاريخ ميلادك وجنسك/);
    // The grace period is config's, never a number typed into the copy.
    for (const s of [ar.deleteAccount.whenBody, en.deleteAccount.whenBody]) {
      expect(s).toMatch(/\{\{days\}\}/);
      expect(s).not.toMatch(/\d/);
    }
  });
});

describe('DA3 the wiring', () => {
  const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

  it('a signed-in member, not a guest, finds «حذف الحساب» in Profile', () => {
    expect(src('app/(tabs)/profile.tsx')).toMatch(/!isGuest \? \([\s\S]*?router\.push\('\/profile\/delete-account'\)/);
  });

  it('asks once more before sending, and offers to cancel a pending request', () => {
    const screen = src('app/profile/delete-account.tsx');
    expect(screen).toMatch(/confirming \?[\s\S]*?loyaltyService\.requestDeletion\(userId\)/);
    expect(screen).toMatch(/loyaltyService\.cancelDeletion\(userId\)/);
    expect(screen).toMatch(/config\.ACCOUNT_DELETION_GRACE_DAYS/);
  });

  it('signing in again withdraws a pending request, and says so', () => {
    const otp = src('app/(auth)/otp.tsx');
    expect(otp).toMatch(/loyaltyService\s*\.cancelDeletion\(user\.id\)/);
    expect(otp).toMatch(/showInfo\(t\('deleteAccount\.cancelledBySignIn'\)\)/);
  });

  it('the live client talks to the routes the server has', () => {
    const live = src('services/loyalty.service.live.ts');
    expect(live).toMatch(/get<[^>]*>\('\/v1\/me\/deletion'\)/);
    expect(live).toMatch(/post<[^>]*>\('\/v1\/me\/deletion', \{\}\)/);
    expect(live).toMatch(/apiDelete<[^>]*>\(BASE, '\/v1\/me\/deletion'/);
  });
});
