import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance, type i18n as I18n } from 'i18next';

import { I18N_OPTIONS } from '@/lib/i18nOptions';
import { formatDate } from '@/lib/format';
import { PointsOwedNote } from '@/components/loyalty/PointsOwedNote';
import { PointsHistory } from '@/components/loyalty/PointsHistory';
import { mockLoyaltyService } from '@/services/loyalty.service.mock';
import { owedNote } from '@almond/shared/loyalty/history';
import type { PointsLogEntry } from '@/types';

/**
 * PO-A1 to PO-A5 — the member sees what a refund left them owing.
 *
 * Review 2026-10-19, item 9: «الدين من المرتجع لا يظهر للعضو، والخصم اللاحق
 * يأتي كسطر غامض». The server half (the balance's `pointsOwed`, the refund
 * line's `pointsOwedChange`, each deduction naming its purchase) is PO1-PO3 in
 * bff/test/points-owed.test.ts. This is the app's half: the sentence, beside
 * the balance on Rewards and on the history page, and the two history lines
 * that explain it.
 */

const language = vi.hoisted(() => ({
  lang: 'ar' as 'ar' | 'en',
  t: (key: string, _params?: Record<string, unknown>): string => key,
}));
vi.mock('@/hooks/useI18n', () => ({ useI18n: () => language }));
vi.mock('@/components/ui/Text', () => ({ Text: ({ children }: { children: React.ReactNode }) =>
  React.createElement('span', null, children) }));
vi.mock('@/components/ui/Icon', () => ({ Icon: ({ name }: { name: string }) =>
  React.createElement('i', { 'data-icon': name }) }));

async function useLanguage(lang: 'ar' | 'en'): Promise<I18n> {
  const i18n = createInstance();
  await i18n.init({ ...I18N_OPTIONS, lng: lang });
  language.lang = lang;
  language.t = (key, params) => i18n.t(key, params);
  return i18n;
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const source = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

beforeEach(() => { vi.stubGlobal('React', React); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('PO-A1 the sentence agrees with its number, in both languages', () => {
  it('Arabic: one, two, a few, many', async () => {
    const ar = await useLanguage('ar');
    const owed = (n: number) => ar.t('loyalty.pointsOwed', { count: n, points: String(n) });
    expect(owed(1)).toBe('عليك نقطة واحدة من مشتريات مُسترَدة، نخصمها من نقاطك القادمة');
    expect(owed(2)).toBe('عليك نقطتان من مشتريات مُسترَدة، نخصمهما من نقاطك القادمة');
    expect(owed(5)).toBe('عليك 5 نقاط من مشتريات مُسترَدة، نخصمها من نقاطك القادمة');
    expect(owed(40)).toBe('عليك 40 نقطة من مشتريات مُسترَدة، نخصمها من نقاطك القادمة');
    expect(owed(120)).toBe('عليك 120 نقطة من مشتريات مُسترَدة، نخصمها من نقاطك القادمة');
    // The refund line is history: what the balance could not cover then,
    // never what is owed now (that is pointsOwed, beside the balance).
    const left = (n: number) => ar.t('loyalty.refundLeftOwed', { count: n, points: String(n) });
    expect(left(1)).toBe('لم يكفِ رصيد نقاطك لخصم نقطة واحدة من هذا الطلب');
    expect(left(2)).toBe('لم يكفِ رصيد نقاطك لخصم نقطتين من هذا الطلب');
    expect(left(7)).toBe('لم يكفِ رصيد نقاطك لخصم 7 نقاط من هذا الطلب');
    expect(left(40)).toBe('لم يكفِ رصيد نقاطك لخصم 40 نقطة من هذا الطلب');
  });

  it('English: one and many', async () => {
    const en = await useLanguage('en');
    expect(en.t('loyalty.pointsOwed', { count: 1, points: '1' }))
      .toBe('You owe 1 point from refunded purchases. We take it from the next points you get.');
    expect(en.t('loyalty.pointsOwed', { count: 40, points: '40' }))
      .toBe('You owe 40 points from refunded purchases. We take them from the next points you get.');
    expect(en.t('loyalty.refundLeftOwed', { count: 1, points: '1' }))
      .toBe('Your points balance was not enough to take back 1 point of this purchase.');
    expect(en.t('loyalty.refundLeftOwed', { count: 40, points: '40' }))
      .toBe('Your points balance was not enough to take back 40 points of this purchase.');
  });
});

describe('PO-A2 one line beside the balance, and nothing when nothing is owed', () => {
  for (const lang of ['ar', 'en'] as const) {
    it(`${lang}: the server's figure, never a sentence about 0`, async () => {
      const i18n = await useLanguage(lang);
      const html = renderToStaticMarkup(React.createElement(PointsOwedNote, { points: 1240 }));
      expect(text(html)).toContain(i18n.t('loyalty.pointsOwed', { count: 1240, points: '1,240' }));
      expect(html).not.toMatch(/[٠-٩]/);
      for (const none of [0, undefined]) {
        expect(renderToStaticMarkup(React.createElement(PointsOwedNote, { points: none }))).toBe('');
      }
    });
  }

  it('the Rewards card and the history page both show it, from the balance', () => {
    expect(source('app/(tabs)/rewards.tsx')).toMatch(/<PointsOwedNote points=\{balance\.pointsOwed\}/);
    expect(source('app/loyalty.tsx')).toMatch(/<PointsOwedNote points=\{balance\.pointsOwed\}/);
  });

  it('the mock, which never refunds, owes nothing', async () => {
    expect((await mockLoyaltyService.getBalance('po-a2')).pointsOwed).toBe(0);
  });
});

describe('PO-A3 the history explains the debt where it starts and where it is paid', () => {
  const bought = '2026-10-12T09:00:00.000Z';
  const lines: PointsLogEntry[] = [
    { id: '5', deltaPoints: -25, pointsOwedChange: -25, kind: 'refund', sourceRef: 'pos:a', branchId: null,
      reasonAr: 'تسوية نقاط طلب مُسترَد', reasonEn: 'Points owed on a refunded purchase', createdAt: '2026-10-18T09:00:00.000Z' },
    { id: '4', deltaPoints: 25, kind: 'transfer', reasonAr: 'نقاط من صديق', reasonEn: 'Points from a friend',
      createdAt: '2026-10-18T09:00:00.000Z' },
    { id: '3', deltaPoints: 0, pointsOwedChange: 40, kind: 'refund', sourceRef: 'pos:a', branchId: 'rabyeh',
      reasonAr: 'خصم نقاط طلب مُسترَد', reasonEn: 'Refunded purchase points', createdAt: '2026-10-14T09:00:00.000Z' },
    { id: '2', deltaPoints: -40, kind: 'transfer', reasonAr: 'تحويل نقاط إلى صديق', reasonEn: 'Points sent to a friend',
      createdAt: '2026-10-13T09:00:00.000Z' },
    { id: '1', deltaPoints: 40, kind: 'purchase', sourceRef: 'pos:a', branchId: 'rabyeh',
      reasonAr: 'نقاط شراء في الفرع', reasonEn: 'In-store purchase points', createdAt: bought },
  ];

  it('the shared rule: the refund says what it left owed; a deduction names the purchase it pays', () => {
    expect(owedNote(lines[2], lines)).toEqual({ kind: 'left', points: 40 });
    expect(owedNote(lines[0], lines)).toEqual({ kind: 'pays', purchase: { createdAt: bought, branchId: 'rabyeh' } });
    expect(owedNote(lines[1], lines)).toBeNull();
    expect(owedNote(lines[4], lines)).toBeNull();
    // A deduction the ledger could not place names nothing, rather than a guess.
    expect(owedNote({ ...lines[0], sourceRef: null }, lines)).toEqual({ kind: 'pays', purchase: null });
  });

  for (const lang of ['ar', 'en'] as const) {
    it(`${lang}: both lines are worded, and the refund never reads «-0» or «+0»`, async () => {
      const i18n = await useLanguage(lang);
      const html = text(renderToStaticMarkup(React.createElement(PointsHistory, { entries: lines })));
      expect(html).toContain(i18n.t('loyalty.refundLeftOwed', { count: 40, points: '40' }));
      const rabyeh = i18n.t('loyalty.historyBranch', { name: lang === 'ar' ? 'الرابية' : 'Rabyeh' });
      // The paying line's whole caption: the purchase it pays AND that
      // purchase's branch. The refund and purchase lines show the branch in
      // their own meta line, so «فرع الرابية» alone proves nothing about the
      // paying line (reviewers, 2026-10-20).
      expect(html).toContain([i18n.t('loyalty.owedFromPurchase', { date: formatDate(bought, lang) }), rabyeh].join(' · '));
      expect(html).not.toMatch(/[+−-]\s*0(?![\d.,])/);
      expect(html).not.toMatch(/[٠-٩]/);
    });
  }
});

describe('PO-A5 a refund whose debt is paid promises no deduction', () => {
  // Reviewers, 2026-10-20: the refund line kept saying «فبقيت عليك 40 نقطة
  // نخصمها من نقاطك القادمة» after the paying line below it had settled all
  // 40. owedNote reads the refund line's own figure, which never changes, so
  // the line may only say what happened then. What is owed now, and the
  // promise to take it from later points, is PointsOwedNote's, which is hidden
  // at 0.
  const lines: PointsLogEntry[] = [
    { id: '4', deltaPoints: -40, pointsOwedChange: -40, kind: 'refund', sourceRef: 'pos:b', branchId: null,
      reasonAr: 'تسوية نقاط طلب مُسترَد', reasonEn: 'Points owed on a refunded purchase', createdAt: '2026-10-19T09:00:00.000Z' },
    { id: '3', deltaPoints: 40, kind: 'transfer', reasonAr: 'نقاط من صديق', reasonEn: 'Points from a friend',
      createdAt: '2026-10-19T09:00:00.000Z' },
    { id: '2', deltaPoints: 0, pointsOwedChange: 40, kind: 'refund', sourceRef: 'pos:b', branchId: 'rabyeh',
      reasonAr: 'خصم نقاط طلب مُسترَد', reasonEn: 'Refunded purchase points', createdAt: '2026-10-14T09:00:00.000Z' },
    { id: '1', deltaPoints: 40, kind: 'purchase', sourceRef: 'pos:b', branchId: 'rabyeh',
      reasonAr: 'نقاط شراء في الفرع', reasonEn: 'In-store purchase points', createdAt: '2026-10-12T09:00:00.000Z' },
  ];
  const promise = { ar: /نخصم|القادمة|عليك/, en: /\bowe\b|next points|we take/i };

  for (const lang of ['ar', 'en'] as const) {
    it(`${lang}: the refund line says what happened, and nothing on the page says points are still owed`, async () => {
      const i18n = await useLanguage(lang);
      const html = text(renderToStaticMarkup(React.createElement(PointsHistory, { entries: lines })));
      expect(html).toContain(i18n.t('loyalty.refundLeftOwed', { count: 40, points: '40' }));
      expect(html).not.toMatch(promise[lang]);
    });
  }

  for (const lang of ['ar', 'en'] as const) {
    it(`${lang}: every form of the refund line is past tense and promises nothing`, async () => {
      const i18n = await useLanguage(lang);
      for (const n of [1, 2, 3, 7, 11, 40, 100, 1240]) {
        expect(i18n.t('loyalty.refundLeftOwed', { count: n, points: String(n) })).not.toMatch(promise[lang]);
      }
    });
  }
});

describe('PO-A4 the public rules say where to find it', () => {
  it('the refund section of the policies page points to Rewards and the history', async () => {
    expect(source('app/profile/policies.tsx')).toContain("t('policies.refundShown')");
    const ar = await useLanguage('ar');
    expect(ar.t('policies.refundShown')).toContain('سجل النقاط');
    const en = await useLanguage('en');
    expect(en.t('policies.refundShown')).toContain('points history');
  });
});
