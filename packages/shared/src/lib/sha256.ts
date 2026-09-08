/**
 * SHA-256 and a UTF-8 encoder, written out in full, with NO host dependency.
 *
 * ⚠ THIS IS A BUCKETING PRIMITIVE, NOT AN AUTHENTICATION ONE. Nothing here
 * signs, verifies or protects anything. JWT signing stays on @fastify/jwt and
 * POS-token signing stays on node:crypto (bff/src/pos/token.ts,
 * bff/src/plugins/auth.ts). The only caller is loyalty/holdout.ts, which needs
 * ONE function that gives the SAME answer on the BFF, on the phone, and in the
 * future Odoo evaluator. Its correctness is cross-checked against node:crypto
 * on the FIPS 180-4 vectors and 2,000 random strings in bff/test/holdout.test.ts.
 *
 * WHY NOT node:crypto — the obvious simplification, which does not compile and
 * would not run:
 *   1. packages/shared/tsconfig.json has NO `"types": ["node"]` and lib
 *      ES2020+DOM. `import { createHash } from 'node:crypto'` fails
 *      `npm run shared:typecheck`, the FIRST step of the root gate.
 *   2. almond-app compiles packages/shared INTO the Expo bundle (tsconfig
 *      paths @almond/shared/* → ../packages/shared/src/*). Hermes has neither
 *      node:crypto nor crypto.subtle, and almond-app/package.json carries no
 *      expo-crypto and no polyfill.
 *   3. TextEncoder typechecks here (it is in the DOM lib) and is ABSENT on
 *      Hermes — it would compile on all four tsconfigs and fail on the phone
 *      only, months later, on a device. So the UTF-8 encoder is hand-rolled too.
 *   4. crypto.subtle is async, which would infect every synchronous call site
 *      of the assignment, computeEarn's neighbours included.
 * A per-platform shim would be three implementations of one draw — the D2
 * divergence that bff/test/earn.test.ts T7 exists to prevent, on a dial T7's
 * name-based walk cannot see.
 *
 * MEASURED COST of the pure version: 9.6 µs per holdout assignment against
 * 3.7 µs for node:crypto. At the doc's 1,133 member orders/day
 * (docs/LOYALTY-ODOO-MODULE.md:1253) that is 11 ms of CPU per DAY.
 *
 * Every intermediate stays inside the exact-integer range of float64: the
 * 32-bit words are kept unsigned with `>>> 0`, and the only value that can
 * exceed 2**32 is a two-word sum, at most ~2**35. No BigInt (not in the ES2020
 * lib this package targets, and not needed).
 */

/** FIPS 180-4 §4.2.2 — the first 32 bits of the fractional parts of the cube
 *  roots of the first 64 primes. */
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** FIPS 180-4 §5.3.3 — fractional parts of the square roots of the first 8 primes. */
const H0 = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

/**
 * UTF-8 bytes of `text`, WHATWG-style: an unpaired surrogate becomes U+FFFD,
 * exactly as Buffer.from(s, 'utf8') and TextEncoder do. That agreement is not
 * cosmetic — it is what lets bff/test/holdout.test.ts use node:crypto as the
 * oracle over random strings that contain astral pairs.
 *
 * The byte COUNT this returns is also the length prefix in
 * canonicalHoldoutInput(). 'm_😀'.length is 4 in JS (UTF-16 code units) and
 * len() is 3 in Python (code points); the UTF-8 byte count is 6 in both, and it
 * is the only measure every language agrees on.
 */
export function utf8Bytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff) {
      const lo = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      } else {
        cp = 0xfffd; // lone high surrogate
      }
    } else if (cp >= 0xdc00 && cp <= 0xdfff) {
      cp = 0xfffd; // lone low surrogate
    }

    if (cp < 0x80) {
      out.push(cp);
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(
        0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f),
      );
    }
  }
  return out;
}

/** The 32 digest bytes of `bytes`. FIPS 180-4 §6.2. */
export function sha256(bytes: readonly number[]): number[] {
  const h = H0.slice();

  // §5.1.1 padding: 0x80, then zeros to 56 mod 64, then the message length in
  // BITS as a 64-bit big-endian integer. bitLen is exact in float64 up to 2**53
  // (a 1 PB message); the split is plain arithmetic, no BigInt.
  const bitLen = bytes.length * 8;
  const padded = bytes.slice();
  padded.push(0x80);
  while (padded.length % 64 !== 56) padded.push(0);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen % 0x100000000;
  padded.push(
    (hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
    (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff,
  );

  const w = new Array<number>(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let t = 0; t < 16; t++) {
      const i = off + t * 4;
      w[t] = ((padded[i] << 24) | (padded[i + 1] << 16) | (padded[i + 2] << 8) | padded[i + 3]) >>> 0;
    }
    for (let t = 16; t < 64; t++) {
      const s0 = (rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)) >>> 0;
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e;
      e = (d + t1) >>> 0;
      d = c; c = b; b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }

  const out: number[] = [];
  for (const word of h) {
    out.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
  }
  return out;
}

/** Lower-case hex of sha256(utf8Bytes(text)). */
export function sha256Hex(text: string): string {
  return sha256(utf8Bytes(text))
    .map((b) => (b < 16 ? '0' : '') + b.toString(16))
    .join('');
}

/**
 * The first 4 digest bytes, big-endian, as an unsigned 32-bit integer —
 * i.e. a uniform draw from [0, 2**32). See loyalty/holdout.ts for why the
 * comparison is against a threshold and not a `% 100` (2**32 % 100 === 96, so
 * the modulo is not uniform).
 *
 * ⚠ This is the same draw `assignHoldout` computes, NOT the code path it runs:
 * holdout.ts:183 open-codes the identical arithmetic inline. Nothing in
 * production calls this function — it is the vector / cross-language-port
 * interface, kept so a Python or Odoo implementation has something to check
 * itself against. The duplication is guarded rather than tolerated:
 * bff/test/holdout.test.ts asserts BOTH copies against the nine checked-in
 * golden vectors, so a drift in either one goes red.
 *
 * Plain multiplication, not `<<`: `d[0] << 24` is SIGNED in JavaScript and goes
 * negative for any digest whose first byte is >= 0x80 — half of them.
 */
export function sha256U32(text: string): number {
  const d = sha256(utf8Bytes(text));
  return d[0] * 16777216 + d[1] * 65536 + d[2] * 256 + d[3];
}
