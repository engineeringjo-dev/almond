/**
 * THE WIRE CONTRACT FOR `POST /v1/pos/token` — the code the member shows at the
 * till.
 *
 * WHAT THIS REPLACES, and why the replacement needs a contract of its own.
 *
 * `almond-app/app/(tabs)/pay.tsx` used to build the barcode itself, as a string:
 *
 *     `ALMOND|MEMBER|${userId}|MODE=${mode === 'pay' ? 'PAY' : 'EARN'}`
 *
 * That code is a BEARER CREDENTIAL rendered from data the app already had on
 * screen. It carries no signature, so anyone who learns a member id can render
 * the same barcode; no expiry, so a photograph of a member's phone works
 * forever; and no single-use marker, so the same capture earns on every visit.
 * The member id is not a secret — it is printed under the QR — so the barcode's
 * only protection was that nobody had thought to try.
 *
 * `bff/src/pos/token.ts` has minted a short-lived, HMAC-signed, single-use
 * token since before this file existed, and `bff/src/routes/pos.ts` has exposed
 * it. Nothing called either one. This module is the seam that makes the app use
 * it, and it enforces the one property the whole change rests on:
 *
 *   🔴 A CLIENT MUST NEVER DISPLAY A CODE IT DID NOT GET FROM THE SERVER, AND
 *      MUST NEVER DISPLAY THE STATIC FORMAT — even if a server sends it.
 *
 * That is why the refusal lives here and not in the screen. A regression that
 * put the old format back on the server (or a proxy, or a stubbed environment)
 * would otherwise reach the phone and render as a perfectly good-looking QR;
 * `parsePosToken` throws a NAMED error instead, and the screen shows the member
 * an actionable failure state rather than a forgeable barcode.
 *
 * Style follows loyalty/balanceWire.ts: the wire has a name on both sides, the
 * producer is annotated with it, and the consumer parses rather than casts.
 */

/** What the member is asking the till to do. See `PosTokenWire.mode`. */
export type PosMode = 'pay' | 'earn';

/** The two modes, as a frozen tuple so the BFF's request schema (`z.enum`) can
 *  be BUILT from this list instead of retyping it. One list, three readers: the
 *  route that accepts the mode, the token that signs it, and the parser that
 *  validates it coming back. */
export const POS_MODES = ['pay', 'earn'] as const satisfies readonly PosMode[];

export interface PosTokenWire {
  /**
   * The opaque code to render as a QR. Opaque is the point: the client neither
   * parses it nor constructs it, so there is no client-side path to a valid
   * code at all.
   */
  token: string;
  /**
   * Seconds the token stays valid, from the moment the response was produced.
   * The CLIENT'S refresh cadence is derived from this and never from a local
   * constant — the server owns the TTL (config.POS_TOKEN_TTL_SECONDS, 60s,
   * overridable by env on the BFF) and an app pinned to its own copy of that
   * number would keep showing dead codes the day an operator changed it.
   */
  expiresIn: number;
  /**
   * WHERE THE PAY/EARN MODE LIVES NOW.
   *
   * The old string carried `MODE=PAY` as plaintext the member's own device
   * wrote. The token is minted and signed by the server, so the mode is a
   * CLAIM INSIDE IT: the app states its intent when it asks for a token, the
   * server signs it, and `POST /v1/pos/scan` hands the till back `{memberId,
   * mode}` from the verified payload. Echoed here so the screen can prove it is
   * displaying a code for the mode the member selected — a toggle whose state
   * the barcode does not carry is a control that does nothing.
   */
  mode: PosMode;
}

/** Thrown when the body is not the contract above. Named, so a caller can tell
 *  "the server sent something else" from "the network failed" — the distinction
 *  a bare cast destroys, and the one the failure state on the Pay screen needs
 *  in order to say something true to the member. */
export class PosTokenWireError extends Error {
  constructor(public readonly path: string, public readonly detail: string) {
    super(`POST /v1/pos/token: ${path} ${detail}`);
    this.name = 'PosTokenWireError';
  }
}

/**
 * THE FORMAT THAT MUST NEVER COME BACK, written out exactly once in the whole
 * repo — here, in the guard that refuses it. `bff/test/security.test.ts` T30
 * walks every source file in every workspace for it and exempts only this line,
 * so a second occurrence anywhere (a screen, a mock, a fixture, an Odoo-side
 * `.py` or POS `.js` file) turns that test red.
 */
const LEGACY_STATIC_QR = /^ALMOND\|MEMBER\|/;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Validate a `POST /v1/pos/token` body. Throws `PosTokenWireError` naming the
 * first field that does not match; never returns a partially-trusted object and
 * never coerces, because a coerced token is a barcode a member holds up to a
 * scanner.
 */
export function parsePosToken(raw: unknown): PosTokenWire {
  if (!isRecord(raw)) throw new PosTokenWireError('(body)', `expected an object, got ${typeof raw}`);

  const token = raw.token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new PosTokenWireError('token', `expected a non-empty string, got ${JSON.stringify(token)}`);
  }
  if (LEGACY_STATIC_QR.test(token)) {
    throw new PosTokenWireError(
      'token',
      'is the retired static member barcode, which is forgeable from a member id'
      + ' alone and replayable forever. It must not be rendered.',
    );
  }
  // The FAMILY, not just the one prefix. Every variant of the retired format —
  // `ALMOND|MEMBER|…`, `…|MODE=PAY`, `MEMBER|<id>` — is pipe-delimited
  // plaintext, and a signed token cannot be: the BFF's is `base64url.base64url`
  // and base64url has no '|' in its alphabet. So the pipe is the tell, and
  // banning it catches the next hand-rolled format too.
  if (token.includes('|')) {
    throw new PosTokenWireError(
      'token',
      'contains "|": a pipe-delimited plaintext code is the hand-rolled barcode'
      + ' family this contract exists to refuse. A signed token is base64url.',
    );
  }

  const expiresIn = raw.expiresIn;
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    // A zero or negative TTL would make the screen refresh in a tight loop
    // against the server that sent it. Refuse it here rather than divide by it.
    throw new PosTokenWireError('expiresIn', `expected a positive finite number of seconds, got ${JSON.stringify(expiresIn)}`);
  }

  const mode = raw.mode;
  if (typeof mode !== 'string' || !POS_MODES.includes(mode as PosMode)) {
    throw new PosTokenWireError('mode', `expected one of ${POS_MODES.join(' | ')}, got ${JSON.stringify(mode)}`);
  }

  return { token, expiresIn, mode: mode as PosMode };
}
