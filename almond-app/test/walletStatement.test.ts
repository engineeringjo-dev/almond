import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { mockLoyaltyService } from '@/services/loyalty.service.mock';
import { pointsLines, walletStatement } from '@almond/shared/loyalty/history';
import { toFils } from '@almond/shared/lib/format';

/**
 * WS1-WS3 — THE WALLET HAS A STATEMENT (expert panel, 2026-10-15: «بلا كشف
 * حركات»). The server's half is T37's wallet-statement contract test; this is
 * the app's: the mock keeps the same ledger, and the screens read it the same
 * way.
 */
const sum = (lines: readonly { deltaFils?: number | null }[]) =>
  lines.reduce((s, l) => s + (l.deltaFils ?? 0), 0);

describe('WS1 the statement adds up to the balance', () => {
  it('for the demo member, and after every kind of movement', async () => {
    const id = `ws-${Date.now()}`;
    const check = async () => {
      const moves = walletStatement(await mockLoyaltyService.getHistory(id));
      expect(sum(moves)).toBe(toFils(await mockLoyaltyService.getWallet(id)));
      return moves;
    };
    expect((await check()).length).toBeGreaterThan(0);
    await mockLoyaltyService.topUp(id, 20);
    await mockLoyaltyService.chargeWallet(id, 3.5);
    const moves = await check();
    expect(moves.slice(0, 2).map((m) => [m.reasonEn, m.deltaFils])).toEqual([
      ['Paid from your balance', -3_500],
      ['Wallet top-up', 20_000],
    ]);
  });

  it('and none of it is in the points history', async () => {
    const id = `ws2-${Date.now()}`;
    await mockLoyaltyService.topUp(id, 20);
    expect(pointsLines(await mockLoyaltyService.getHistory(id)).some((l) => l.kind === 'wallet')).toBe(false);
  });
});

describe('WS2 the screens read the one ledger through the shared filters', () => {
  const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');
  it('the wallet shows walletStatement, an empty state, and a failed top-up', () => {
    const s = src('app/profile/wallet.tsx');
    expect(s).toMatch(/walletStatement\(historyQ\.data \?\? \[\]\)/);
    expect(s).toMatch(/t\('profile\.walletEmpty'\)/);
    expect(s).toMatch(/topUp\.isError \?/);
  });

  it('the points history shows pointsLines', () => {
    expect(src('components/loyalty/PointsHistory.tsx')).toMatch(/const entries = pointsLines\(ledger\)/);
  });

  it('the mock words every wallet line through the shared table, as the server does', () => {
    const mock = src('services/loyalty.service.mock.ts');
    expect(mock).toMatch(/WALLET_LINE_REASON\[kind\]\.ar/);
    // No wallet line written by hand: a literal is a second wording.
    expect(mock).not.toMatch(/kind: 'wallet' \}\)/);
  });
});
