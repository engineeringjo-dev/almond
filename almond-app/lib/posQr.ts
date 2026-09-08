import type { PosTokenWire } from '@almond/shared/pos/tokenWire';

/**
 * THE PAY SCREEN'S TIMING AND STATE, as pure functions.
 *
 * The screen shows a code that DIES ON A WALL CLOCK (config.POS_TOKEN_TTL_SECONDS,
 * 60s — the server's number, read off each response, never a copy kept here).
 * Three questions follow from that, and all three are answered here rather than
 * inside a component, because almond-app has no renderer in this repo: anything
 * that lives in a `.tsx` file is verified by `tsc --noEmit` and by nothing else.
 *
 *   1. WHEN DOES IT REFRESH?          posQrRefreshMs
 *   2. WHAT IS ON SCREEN RIGHT NOW?   posQrStatus
 *   3. WHAT DOES THE MEMBER SEE IN THE GAP BETWEEN THE TWO?
 *
 * (3) is the question the whole design turns on, so here is the answer in full.
 * There is no gap in the normal case, by construction: the refresh fires at
 * HALF the lifetime, so the replacement is requested while the displayed code
 * is still valid for another thirty seconds, and it simply swaps underneath the
 * member. The old code stays scannable the entire time the new one is in
 * flight — nothing is blanked, and a member holding their phone out at the
 * counter never sees the barcode disappear because of a refresh.
 *
 * A gap can only open when the refresh FAILS repeatedly (no signal at the
 * counter is the realistic case; a coffee shop's dead spot lasts longer than a
 * minute). Even then the displayed token is NOT thrown away: it is still signed
 * and still inside its own expiry, so it is still a working code, and the
 * screen keeps showing it until the moment it really expires. Only then does
 * the QR come down — and what replaces it is an actionable panel, not a
 * silently stale square that the cashier's scanner will beep at.
 *
 * 🔴 WHAT MUST NEVER HAPPEN IN THE GAP: falling back to a locally-built code.
 * That is the exact defect this package removes, and it would come back wearing
 * the clothes of a kindness ("show SOMETHING so the member isn't stuck"). There
 * is no client-side path to a valid code at all — see
 * @almond/shared/pos/tokenWire, which refuses the retired format even if a
 * server sends it.
 */

/**
 * Refresh at HALF the token's lifetime.
 *
 * Why a fraction and not "TTL minus N seconds": the TTL is the server's dial
 * (config.POS_TOKEN_TTL_SECONDS, and the BFF lets an operator shorten it by
 * env var without an app release). A fixed subtraction breaks at the short end
 * — at a 20-second TTL, "expiry minus 15" refreshes every 5 seconds — while a
 * fraction scales.
 *
 * Why one half and not something tighter: the margin has to cover the request
 * itself, the phone's clock skew against the server's, and the member walking
 * from their table to the counter with the screen already open. At the shipped
 * 60-second TTL that is a 30-second margin against a till interaction measured
 * at well under a second. Tighter buys nothing; the token is single-use, so
 * refreshing more often does not make anything safer.
 */
export const POS_QR_REFRESH_FRACTION = 0.5;

/**
 * Never poll faster than this, whatever the server says. A misconfigured (or
 * hostile) TTL of 1 second would otherwise turn every open Pay screen into a
 * two-requests-per-second load generator against the BFF — and Pay is the
 * app's most-visited tab.
 *
 * 🔴 THE FLOOR WINS OVER THE MARGIN, and that is a deliberate trade with a
 * visible cost. Below a TTL of twice this floor (10 seconds) the fraction would
 * ask for a faster poll than the floor permits, the floor is applied instead,
 * and the code can therefore die a moment before its replacement is requested —
 * the member sees the `expired` panel and one tap fixes it. That is the correct
 * failure: a server asking a phone to mint four codes a minute is misconfigured,
 * and the screen degrading is how anyone finds out. At every plausible setting
 * (the shipped 60s, or anything from 10s up) the refresh lands strictly before
 * the expiry and no gap exists at all. P1 in almond-app/test/posQr.test.ts pins
 * both halves of this.
 */
export const POS_QR_MIN_REFRESH_MS = 5_000;

/** Milliseconds to wait before asking for the next code, given the lifetime the
 *  server reported for the current one. */
export function posQrRefreshMs(expiresInSeconds: number): number {
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) return POS_QR_MIN_REFRESH_MS;
  return Math.max(POS_QR_MIN_REFRESH_MS, expiresInSeconds * 1000 * POS_QR_REFRESH_FRACTION);
}

/** When the code in hand stops being valid, in epoch ms. `receivedAt` is the
 *  moment the response landed (react-query's `dataUpdatedAt`), because
 *  `expiresIn` is relative to the response, not to render time. */
export function posQrExpiresAt(wire: Pick<PosTokenWire, 'expiresIn'>, receivedAt: number): number {
  return receivedAt + wire.expiresIn * 1000;
}

export type PosQrStatus =
  /** A signed, unexpired code is on screen. */
  | 'ready'
  /** Nothing to show yet and a request is in flight — first open, or the member
   *  just switched PAY/EARN, which asks for a new code bound to the new mode. */
  | 'pending'
  /** We had a code and it died before a replacement arrived. Actionable: retry. */
  | 'expired'
  /** We never got one. Offline at the counter, or the server refused. */
  | 'unavailable';

export interface PosQrInput {
  /** The code in hand, or null if the request has not succeeded yet. */
  token: string | null;
  /** posQrExpiresAt(...) for that code, or null when there is no code. */
  expiresAt: number | null;
  /** Now, in epoch ms. */
  now: number;
  /** Is a request in flight? */
  fetching: boolean;
  /**
   * Has the request produced an ANSWER yet — a token or a failure?
   *
   * 🔴 "WE HAVE NOT ASKED YET" IS NOT "WE ASKED AND GOT NOTHING", and the
   * screen says something different and false if the two are conflated. The
   * Pay screen's query is `enabled: focused`, and `focused` is set by
   * useFocusEffect — a passive effect, so it is false on the first render of
   * every open of the tab. In that render there is no token AND no request in
   * flight, which read as `unavailable`: the member was shown "We can't show
   * your code — you may be offline. Try again, or give the cashier your member
   * ID" before the app had made a single request. That panel is the honest
   * answer to a real failure and a lie about a screen that has not tried.
   *
   * Optional and defaulting to TRUE, so a caller that genuinely knows nothing
   * about settling keeps the plain four-state reading: the field can only ever
   * turn a false failure into a wait, never a real failure into one.
   */
  settled?: boolean;
}

/**
 * Which of the four things the screen is showing. The ORDER of these branches
 * is the design decision:
 *
 *   - a valid code beats everything, including an in-flight refresh, so a
 *     refresh never blanks a scannable barcode;
 *   - an in-flight request beats an expired code, because offering "Retry" to
 *     someone whose retry is already running is a button that lies;
 *   - `expired` and `unavailable` are told apart because the member can act on
 *     them differently: an expired code is one tap from working, while no code
 *     at all means asking the cashier to look the account up instead;
 *   - and `unavailable` is reserved for a request that actually FAILED. A
 *     screen that has not asked yet is waiting, not offline — see
 *     `PosQrInput.settled`.
 */
export function posQrStatus({ token, expiresAt, now, fetching, settled = true }: PosQrInput): PosQrStatus {
  if (token && expiresAt !== null && now < expiresAt) return 'ready';
  if (fetching || !settled) return 'pending';
  if (token) return 'expired';
  return 'unavailable';
}

/** Milliseconds until the displayed code expires, floored at 0. The screen uses
 *  this to schedule ONE timer that flips it to `expired` at exactly the right
 *  instant, instead of re-rendering every second to find out. */
export function posQrMsUntilExpiry(expiresAt: number | null, now: number): number {
  if (expiresAt === null) return 0;
  return Math.max(0, expiresAt - now);
}
