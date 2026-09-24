import { randomInt } from 'node:crypto';
import {
  REFERRAL_CODE_ALPHABET, REFERRAL_CODE_LENGTH, type ReferralAttachError,
} from '@almond/shared/loyalty/referral';
import type { TransferKind, TransferRefusal } from '@almond/shared/loyalty/transfer';
import { toJod } from './money';
import { HttpError, conflict } from './http-error';
import type { HistoryEntry } from './backend/types';

/**
 * The member-to-member rules BOTH stores apply — the referral reward and the
 * transfer to a friend — written once, here, so memory.ts and postgres.ts
 * cannot word a ledger line or an error differently (the same arrangement as
 * pos/sales.ts for the till). The arithmetic is @almond/shared's
 * (loyalty/referral.ts, loyalty/transfer.ts, loyalty/lots.ts); what stays here
 * is wording, codes and the code generator.
 */

/** A referral code, from a cryptographic source — it pays whoever owns it, so
 *  it must not be predictable (the same argument as the redemption code). */
export function newReferralCode(): string {
  let out = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i += 1) {
    out += REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)];
  }
  return out;
}

export const referralCodeNotFound = () =>
  new HttpError(404, 'referral_code_not_found', 'no member has this referral code');

const ATTACH_MESSAGES: Record<ReferralAttachError, string> = {
  referral_self: 'a member cannot use their own referral code',
  referral_same_phone: 'this code belongs to an account on the same phone number',
  referral_already_attached: 'a referral code is already attached to this account — it can be set once',
  referral_too_late: 'a referral code can only be added before the first paid order',
};
export const attachRefused = (code: ReferralAttachError) => conflict(code, ATTACH_MESSAGES[code]);

/** The referrer's ledger line. The friend's name is NOT in it: a history row
 *  outlives the friendship and is shown on a screen. */
export const referralRewardLine = (points: number, at: Date): HistoryEntry => ({
  deltaPoints: points, reasonAr: 'مكافأة دعوة صديق', reasonEn: 'Referral reward', createdAt: at.toISOString(),
});

const TRANSFER_MESSAGES: Record<TransferRefusal, string> = {
  transfer_to_self: 'you cannot send points or balance to yourself',
  transfer_below_min: 'this amount is below the smallest transfer allowed',
  transfer_daily_cap: 'this would pass your daily transfer limit — try a smaller amount or tomorrow',
};
export const transferRefused = (code: TransferRefusal) => conflict(code, TRANSFER_MESSAGES[code]);

/**
 * The two ledger lines one transfer writes — one per member, in the SAME
 * transaction as the move itself. Points carry their count in `deltaPoints`
 * (so `unexplainedPoints` stays exact for both members); wallet money is not
 * points, so its lines carry 0 there and name the amount in the reason, the way
 * a wallet expiry line already does.
 */
export function transferLines(kind: TransferKind, amount: number, at: Date): {
  sender: HistoryEntry; recipient: HistoryEntry;
} {
  const createdAt = at.toISOString();
  if (kind === 'points') {
    return {
      sender: { deltaPoints: -amount, reasonAr: 'تحويل نقاط إلى صديق', reasonEn: 'Points sent to a friend', createdAt },
      recipient: { deltaPoints: amount, reasonAr: 'نقاط من صديق', reasonEn: 'Points from a friend', createdAt },
    };
  }
  const jod = toJod(amount).toFixed(3);
  return {
    sender: {
      deltaPoints: 0, reasonAr: `تحويل رصيد إلى صديق (-${jod} د.أ)`,
      reasonEn: `Balance sent to a friend (-${jod} JOD)`, createdAt,
    },
    recipient: {
      deltaPoints: 0, reasonAr: `رصيد من صديق (+${jod} د.أ)`,
      reasonEn: `Balance from a friend (+${jod} JOD)`, createdAt,
    },
  };
}

/** The short-balance refusal for each kind — the SAME codes every other spend
 *  of that ledger already uses, so a client handles "not enough" once. */
export const insufficientFor = (kind: TransferKind) => (kind === 'points'
  ? conflict('insufficient_points', 'Not enough points')
  : conflict('insufficient_wallet', 'Wallet balance is not enough'));
