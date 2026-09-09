/**
 * A REDEMPTION — the thing a member takes to the till, or types on the website,
 * after spending points.
 *
 * Owner, 2026-09-09: «حتى الي بده يصرف نقاطه بده يعمل redeem ويطلع qr code
 * مؤقت يقرأ على الكاش او رمز سري اذا كان يشتري من الموقع».
 *
 * 🔴 WHAT THIS FIXES, AND IT IS NOT COSMETIC. `POST /v1/loyalty/redeem` called
 * `spendPoints` and returned `valueJod`. Nothing else happened: no voucher row,
 * no code, no barcode, and `/v1/pos/scan` returned `{memberId, mode}` only. A
 * member who redeemed in the live backend lost their points and there was
 * nothing anywhere for a cashier to act on. The app's mock invented a voucher,
 * which is why nobody noticed — the mock was carrying a rail the server did not
 * have.
 *
 * TWO REPRESENTATIONS, ONE REDEMPTION:
 *   - a CODE the member reads out or types on the website;
 *   - a QR minted from it for the till, short-lived and single-use.
 *
 * THE LIFETIMES DIFFER ON PURPOSE. The owner asked for a QR «صلاحيته دقيقة منذ
 * انشاءه» — a minute old at most. That is right for a code held up to a
 * scanner, and far too short for a website checkout, where the member still has
 * to reach the payment step. So the REDEMPTION lives long enough to be used
 * (default 15 minutes) and the QR is minted from it on demand with the existing
 * 60-second POS token. The member can always show a fresh one; a photograph of
 * an old one is worthless within the minute.
 *
 * 🔴 THE MONEY INVARIANT: POINTS ARE NEVER LOST WITHOUT VALUE DELIVERED.
 * Points are spent when the redemption is CREATED — that is what makes a
 * double-spend impossible, and it keeps the member's balance honest the moment
 * they act. If the redemption then expires unused, the points are RETURNED, in
 * full. The alternative (hold without spending) leaves a balance that says one
 * thing and buys another.
 */

/**
 * The code alphabet: digits and uppercase letters, MINUS the four pairs a human
 * reads wrong down a phone line or off a screen — 0/O, 1/I, and L, plus U
 * (which is heard as "you"). What is left is unambiguous when spoken aloud,
 * which is the actual use: the member reads it to a cashier.
 */
export const REDEMPTION_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 8 characters over a 30-symbol alphabet ≈ 6.6e11 codes. Not a secret to be
 *  brute-forced offline — it lives 15 minutes and the settle route is rate
 *  limited — but wide enough that guessing an ACTIVE one is hopeless. */
export const REDEMPTION_CODE_LENGTH = 8;

/** Formatted for reading aloud: `ABCD-EFGH`. The dash is presentation only;
 *  `normalizeRedemptionCode` strips it, so a member may type it either way. */
export function formatRedemptionCode(code: string): string {
  const c = normalizeRedemptionCode(code);
  return c.length === REDEMPTION_CODE_LENGTH ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/**
 * Upper-cased, with spaces and dashes removed, so `abcd-efgh`, `ABCD EFGH` and
 * `ABCDEFGH` are one code.
 *
 * 🔴 AMBIGUITY IS HANDLED AT GENERATION, NOT HERE, AND THAT IS DELIBERATE. The
 * first version of this function tried to be helpful — mapping `O`→`0`, `I`→`1`
 * and then stripping those, since neither is in the alphabet. That DELETED the
 * character and shifted everything after it, so a member who typed one wrong
 * letter got a different eight-character string that could, in principle, be
 * somebody else's live code. A normaliser must never invent a valid input out
 * of an invalid one.
 *
 * Because `REDEMPTION_ALPHABET` excludes every confusable character, a misread
 * simply produces something that is not a code, `isRedemptionCodeShape` says
 * so, and the member is asked to check it — which is the honest outcome and the
 * safe one.
 */
export function normalizeRedemptionCode(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().replace(/[\s-]/g, '');
}

/** Shape only — says nothing about whether it exists or is still live. */
export function isRedemptionCodeShape(code: string): boolean {
  return new RegExp(`^[${REDEMPTION_ALPHABET}]{${REDEMPTION_CODE_LENGTH}}$`)
    .test(normalizeRedemptionCode(code));
}

export type RedemptionStatus = 'pending' | 'settled' | 'expired' | 'cancelled';

export interface RedemptionRow {
  id: string;
  memberId: string;
  code: string;
  /** Whole points spent to create it. What is returned if it expires. */
  points: number;
  /** What it takes off a bill — `jodFromPoints(points)`, computed ONCE at
   *  creation and stored, so a later change to the redemption rate cannot
   *  revalue a code already in a member's hand. */
  valueJod: number;
  createdAt: string;
  expiresAt: string;
  /** Set when the till or the website consumed it. The double-spend guard. */
  settledAt: string | null;
  /** Set when the member cancelled, or the sweep returned the points. */
  cancelledAt: string | null;
  /** Where it was consumed, for the report. */
  settledVia: 'pos' | 'web' | null;
}

/**
 * The status, DERIVED from the row and the clock — never stored.
 *
 * Same reasoning as `secondVisitStatus`: a stored `expired` flag would go on
 * saying `pending` for months past the expiry, because there is no cron in the
 * BFF to flip it. A derived answer is right the instant it is asked.
 */
export function redemptionStatus(row: RedemptionRow, now: Date): RedemptionStatus {
  if (row.settledAt) return 'settled';
  if (row.cancelledAt) return 'cancelled';
  return Date.parse(row.expiresAt) <= now.getTime() ? 'expired' : 'pending';
}

/** Can this row still be consumed? The one question the till and the website
 *  both ask, so neither reimplements the three-way test. */
export function isRedeemable(row: RedemptionRow, now: Date): boolean {
  return redemptionStatus(row, now) === 'pending';
}

/**
 * 🔴 SHOULD THE POINTS GO BACK? True for a redemption that ran out of time or
 * was cancelled and has not already been refunded.
 *
 * The refund is what makes spending-at-creation honest. Without it a member who
 * opened the redeem screen, was called away, and came back an hour later would
 * simply be poorer — and the app would have taken the points for a code that
 * never bought anything.
 */
export function shouldRefund(row: RedemptionRow, now: Date): boolean {
  if (row.settledAt) return false;          // it bought something
  if (row.cancelledAt) return false;        // already returned
  return Date.parse(row.expiresAt) <= now.getTime();
}

export function redemptionExpiresAt(at: Date, ttlSeconds: number): string {
  return new Date(at.getTime() + ttlSeconds * 1000).toISOString();
}

/** What the member's screen shows. `code` is formatted for reading aloud. */
export interface RedemptionView {
  id: string;
  code: string;
  points: number;
  valueJod: number;
  status: RedemptionStatus;
  expiresAt: string;
  /** Whole seconds left, floored at 0 — what the countdown renders. */
  expiresIn: number;
}

export function toRedemptionView(row: RedemptionRow, now: Date): RedemptionView {
  return {
    id: row.id,
    code: formatRedemptionCode(row.code),
    points: row.points,
    valueJod: row.valueJod,
    status: redemptionStatus(row, now),
    expiresAt: row.expiresAt,
    expiresIn: Math.max(0, Math.floor((Date.parse(row.expiresAt) - now.getTime()) / 1000)),
  };
}
