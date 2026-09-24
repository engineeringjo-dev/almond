/**
 * TRANSFERS TO A FRIEND — points or wallet balance, member to member.
 *
 * Owner, 2026-09-24: a member may send POINTS or WALLET BALANCE to another
 * member — REGISTERED only (found by phone, never created by the send) — with
 * a DAILY CAP. This module is the rule; the BFF's backends move the money under
 * both members' locks and ask it the questions below.
 *
 * ── WHAT MOVES, AND WHAT DOES NOT ──────────────────────────────────────────
 *
 *  - POINTS move as LOT SLICES, oldest first (consumeFifo → spentSlices →
 *    restoreSlices, loyalty/lots.ts), so every point arrives with the grant
 *    date and the expiry day it left with. A transfer is not a grant: it must
 *    not hand the recipient a fresh twelve months («ولا تتجدد») — the same rule
 *    the till's void already obeys.
 *  - WALLET balance moves the same way, in fils, on the money ledger's lots.
 *  - NOTHING moves on the tier window. A transfer is not a purchase: it is not
 *    qualifying spend for either member, so neither can buy a rung with it.
 *
 * ── THE CAP ────────────────────────────────────────────────────────────────
 *
 * Per SENDER, per AMMAN business day (ammanDayKey — never the host's date),
 * counting only transfers that went through. Points and wallet are capped
 * separately. What it bounds is a stolen session: a phone left unlocked on a
 * café table can move at most one day's cap before its owner notices.
 */

import { config } from '../config';
import { toFils } from '../lib/format';

export type TransferKind = 'points' | 'wallet';
export const TRANSFER_KINDS = ['points', 'wallet'] as const satisfies readonly TransferKind[];

/** Every dial, in the unit the ledger holds: points, or FILS. */
export interface TransferRules {
  pointsDailyMax: number;
  pointsMin: number;
  walletDailyMaxFils: number;
  walletMinFils: number;
}

export function transferRulesFromConfig(): TransferRules {
  return {
    pointsDailyMax: config.TRANSFER_POINTS_DAILY_MAX,
    pointsMin: config.TRANSFER_POINTS_MIN,
    walletDailyMaxFils: toFils(config.TRANSFER_WALLET_DAILY_MAX_JOD),
    walletMinFils: toFils(config.TRANSFER_WALLET_MIN_JOD),
  };
}

/** Why a transfer is refused before any balance is looked at. Machine codes;
 *  `insufficient_points` / `insufficient_wallet` are the backend's (the same
 *  codes every other spend uses), because only it can read a live balance. */
export type TransferRefusal = 'transfer_to_self' | 'transfer_below_min' | 'transfer_daily_cap';

const dailyMax = (kind: TransferKind, r: TransferRules): number =>
  kind === 'points' ? r.pointsDailyMax : r.walletDailyMaxFils;
const minimum = (kind: TransferKind, r: TransferRules): number =>
  kind === 'points' ? r.pointsMin : r.walletMinFils;

/** How much more this sender may send today (points, or fils). Never negative. */
export function transferRemainingToday(
  kind: TransferKind,
  sentToday: number,
  rules: TransferRules = transferRulesFromConfig(),
): number {
  const max = dailyMax(kind, rules);
  if (!Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.floor(max) - Math.max(0, Math.floor(sentToday || 0)));
}

/**
 * `null` when the transfer may proceed to the balance check; otherwise why not.
 *
 * `amount` is WHOLE points or WHOLE fils. `sentToday` is what this sender has
 * already sent TODAY (Amman) of this kind — read by the backend UNDER THE
 * SENDER'S LOCK, so two parallel transfers cannot each see the other's half of
 * the cap as unspent.
 *
 * A cap dial that is 0 or nonsense refuses everything (fail closed): the
 * mechanism is switched off by setting its cap to 0.
 */
export function transferRefusal(
  input: { kind: TransferKind; amount: number; sentToday: number; senderId: string; recipientId: string },
  rules: TransferRules = transferRulesFromConfig(),
): TransferRefusal | null {
  if (input.senderId === input.recipientId) return 'transfer_to_self';
  if (!Number.isInteger(input.amount) || input.amount < Math.max(1, minimum(input.kind, rules))) {
    return 'transfer_below_min';
  }
  if (input.amount > transferRemainingToday(input.kind, input.sentToday, rules)) return 'transfer_daily_cap';
  return null;
}
