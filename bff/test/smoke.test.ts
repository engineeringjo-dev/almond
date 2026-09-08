import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { config } from '@almond/shared/config';
import { menuItems } from '@almond/shared/menu';
import { itemKind } from '@almond/shared/lib/categoryKind';
import { getComboStarter } from '@almond/shared/lib/recommendations';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import { tiers } from '@almond/shared/loyalty';
import {
  assignHoldout, holdoutSpecFromConfig, receivesTreatment,
} from '@almond/shared/loyalty/holdout';
import {
  BalanceWireError, parseMeBalance, toLoyaltyBalance,
} from '@almond/shared/loyalty/balanceWire';
import { shiftDayKey } from '@almond/shared/loyalty/window';
import { parsePosToken } from '@almond/shared/pos/tokenWire';
import { verifyPosToken } from '../src/pos/token';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import type { Backend } from '../src/backend';
import { signIn } from './lib/signIn';

/**
 * SMOKE — the whole journey, through the real server, in one file.
 *
 * WHAT THIS SUITE IS FOR, and why the other 191 tests do not cover it.
 *
 * Every other suite here proves a PIECE: the window rolls, the holdout is
 * stable, the voucher cannot be double-spent, the copy matches the config. All
 * of them can be green while the ASSEMBLY is broken — a route never registered,
 * a Backend method no handler ever calls, a module nothing imports, a field the
 * screen reads and the server never sends. Unit suites construct their own
 * inputs, so none of them can see a missing wire.
 *
 * So this one boots the real server (`build()` — every route registered exactly
 * as production registers them) and walks ONE member from sign-in to the top
 * rung over HTTP, asserting THE NUMBERS the server returns at each step:
 *
 *   S1  sign in, empty standing
 *   S2  first drink order — 2 pts/JOD, and the second-visit voucher issues
 *   S3  cross 20 JOD — the crossing invoice is paid at the OLD rung, the next
 *       one at 4 pts/JOD
 *   S3b the visits door — four distinct days promotes at ~7 JOD, a third of
 *       the 20 JOD threshold
 *   S4  cross 65 JOD — 6 pts/JOD, nothing left to promise
 *   S5  90 days of silence — window AND visit days collapse to zero, the rate
 *       does NOT, and the next invoice is still paid at 6%
 *   S6  redeem the voucher once; a retry replays, a fresh key is refused
 *   S7  a checkout retried with the same Idempotency-Key grants once
 *   S8  the app/server seam: the real body, parsed and mapped into the type
 *       the screens actually read
 *   S9  the till handshake: the member asks for a code, the code is signed,
 *       fresh on every ask, and burns on the first scan
 *   S10 the offers-page combo: the exact pair the card's one tap adds is
 *       recognised by the checkout route and paid the bonus it advertises
 *
 * TWO SETUP STEPS CANNOT GO OVER HTTP and are honest about it: back-dating a
 * sale (S3b) and moving the clock (S5). There is no route that does either —
 * `build(backend)` is injectable for exactly this reason (see src/server.ts).
 * In both cases the SETUP is injected and the PAYOUT is measured over HTTP.
 *
 * Numbers are asserted against `config` and the shipped tier ramp, never
 * against computeEarn: re-deriving the expectation with the same function the
 * route used would make the assertion a tautology. `Math.round(total × 2 ×
 * ramp)` is the offer written out (2% / 4% / 6% back, 1 point = 1 qirsh).
 */

const SPEC = holdoutSpecFromConfig('secondVisitVoucher');
const RAMP = Object.fromEntries(tiers.map((t) => [t.id, t.multiplier]));

/** A real drink from the shipped menu, classified by the same function
 *  production uses (itemKind, not the record's `isDrink` — 14 of 83 "drinks"
 *  are retail bags). The voucher is drink-conditional, so this matters. */
const DRINK = menuItems.find(
  (m) => itemKind(m.id) === 'drink' && m.inStock !== false && m.sizes[0]?.price > 0,
)!;

const line = (qty = 1) => ({ itemId: DRINK.id, sizeId: DRINK.sizes[0].id, optionIds: [] as string[], qty });

/** The offer, written out: points = round(tax-inclusive total × 2 × the rung's
 *  ramp). A single-kind basket makes no combo pair, so nothing is added. */
const expectedPoints = (total: number, rungId: string): number =>
  Math.round(total * config.POINTS_PER_JOD * RAMP[rungId]);

/** "N points per JOD", stated as the customer would hear it. The grant is
 *  rounded to a whole point (1 point = 1 qirsh exactly), so the honest
 *  tolerance is half a point on the invoice — not a percentage band, which on a
 *  4 JOD basket would be looser than the rounding it is trying to see past. */
const expectRate = (points: number, total: number, perJod: number): void => {
  expect(
    Math.abs(points - total * perJod),
    `${points} pts on ${total} JOD is not ${perJod} pts/JOD`,
  ).toBeLessThanOrEqual(0.5);
};

let app: FastifyInstance;
let backend: Backend;
let phoneSeq = 700;
const nextPhone = () => `+96278${String(++phoneSeq).padStart(7, '0')}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authOf = (token: string, extra: Record<string, string> = {}): any =>
  ({ authorization: `Bearer ${token}`, ...extra });

async function enrol(on = app): Promise<{ token: string; id: string }> {
  const phone = nextPhone();
  const token = await signIn(on, phone);
  const id = (await backend.findOrCreateByPhone(phone)).id;
  return { token, id };
}

/** Enrol until a member lands in the TREATMENT arm. The arm is derived from the
 *  member id and memory.ts mints `m_<uuid>` at first sign-in, so it is not
 *  addressable from outside — this is the same idiom secondVisit.test.ts uses.
 *  At the configured 20% control share, 40 attempts fail with p ≈ 1e-28. */
async function enrolTreatment(): Promise<{ token: string; id: string }> {
  for (let i = 0; i < 40; i++) {
    const m = await enrol();
    if (receivesTreatment(assignHoldout(m.id, SPEC))) return m;
  }
  throw new Error('no treatment-arm member in 40 enrolments');
}

async function balance(token: string) {
  const res = await app.inject({ method: 'GET', url: '/v1/me/balance', headers: authOf(token) });
  expect(res.statusCode, res.body).toBe(200);
  // Every read in this suite goes through the SHARED wire parser, so a shape
  // drift on this route fails the smoke walk rather than being discovered on a
  // phone. parseMeBalance throws a named BalanceWireError.
  return parseMeBalance(res.json());
}

async function checkout(token: string, qty = 1, key = randomUUID(), on = app) {
  return on.inject({
    method: 'POST',
    url: '/v1/checkout',
    payload: { branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash', lines: [line(qty)] },
    headers: authOf(token, { 'idempotency-key': key }),
  });
}

/** Check out and assert the grant matches the rung the member HELD going in. */
async function buy(token: string, qty = 1) {
  const before = await balance(token);
  const res = await checkout(token, qty);
  expect(res.statusCode, res.body).toBe(201);
  const body = res.json();
  expect(
    body.pointsEarned,
    `${body.total} JOD at rung ${before.tier.id}`,
  ).toBe(expectedPoints(body.total, before.tier.id));
  return { before, body };
}

beforeAll(async () => {
  backend = createMemoryBackend();
  app = await build(backend);
});

describe('SMOKE: one member, one server, sign-in to the top rung', () => {
  it('S1 a new member starts empty, on the entry rung, four visits from the next', async () => {
    const { token } = await enrol();
    const b = await balance(token);

    expect(b.points).toBe(0);
    expect(b.windowSpend).toBe(0);
    expect(b.visitDays).toBe(0);
    expect(b.tier.id).toBe('base');
    // The rung's NAME is the rate. If this ever says anything but the entry
    // rate, the customer is being told a number the code does not pay.
    expect(b.tier.nameEn).toBe('2%');
    expect(b.tier.multiplier).toBe(1);
    expect(b.nextTier).not.toBeNull();
    expect(b.nextTier!.id).toBe('plus');
    expect(b.nextTier!.threshold).toBe(20);
    expect(b.nextTier!.jodRemaining).toBe(20);
    // The DOOR, not a spend projection — and it is a guarantee, which is the
    // only condition under which the app is allowed to promise it.
    expect(b.nextTier!.visitsRemaining).toBe(config.TIER2_VISITS_ALTERNATIVE);
    expect(b.nextTier!.visitsGuaranteed).toBe(true);
  });

  it('S2 the first drink order pays 2% and issues the second-visit voucher', async () => {
    const { token } = await enrolTreatment();
    const { body } = await buy(token);

    // 2 points per JOD = 2% back, because 1 point is 1 qirsh exactly.
    expectRate(body.pointsEarned, body.total, 2);
    expect(body.pointsBalance).toBe(body.pointsEarned);

    // The flagship mechanic, on the wire, from the real route.
    expect(body.secondVisitVoucher).not.toBeNull();
    expect(body.secondVisitVoucher.type).toBe('free-item');
    expect(body.secondVisitVoucher.status).toBe('active');
    expect(body.secondVisitVoucher.used).toBe(false);
    expect(body.secondVisitVoucher.redeemedAt).toBeNull();

    // ... and the READ route returns the same live row (GET /v1/me/voucher is
    // registered, reaches the Backend, and agrees with the checkout body).
    const read = await app.inject({ method: 'GET', url: '/v1/me/voucher', headers: authOf(token) });
    expect(read.statusCode).toBe(200);
    expect(read.json().voucher.id).toBe(body.secondVisitVoucher.id);

    const after = await balance(token);
    expect(after.points).toBe(body.pointsEarned);
    expect(after.windowSpend).toBeCloseTo(body.total, 6);
    expect(after.visitDays).toBe(1);
    expect(after.tier.id).toBe('base');
    // One day banked, so three of the four remain — still a guarantee.
    expect(after.nextTier!.visitsRemaining).toBe(config.TIER2_VISITS_ALTERNATIVE - 1);
    expect(after.nextTier!.visitsGuaranteed).toBe(true);
  });

  it('S2b a control-arm member is refused the voucher, and cannot tell', async () => {
    // The suppression is evaluated on the REAL route, not only in the pure
    // function: this is the half a unit test cannot see.
    let holdout: { token: string; id: string } | null = null;
    for (let i = 0; i < 40 && !holdout; i++) {
      const m = await enrol();
      if (!receivesTreatment(assignHoldout(m.id, SPEC))) holdout = m;
    }
    expect(holdout, 'no control-arm member in 40 enrolments').not.toBeNull();

    const res = await checkout(holdout!.token, 1);
    expect(res.statusCode).toBe(201);
    expect(res.json().secondVisitVoucher).toBeNull();

    // Byte-identical to a member who was never eligible at all.
    const read = await app.inject({
      method: 'GET', url: '/v1/me/voucher', headers: authOf(holdout!.token),
    });
    expect(read.body).toBe('{"voucher":null}');
  });

  it('S3 crossing 20 JOD: the crossing invoice pays the old rate, the next one pays 4%', async () => {
    const { token } = await enrol();

    // Cross the threshold in one basket. The rung is read BEFORE the sale, so
    // this invoice is still paid at 2% — deliberate, and the assertion inside
    // buy() is what pins it.
    const crossing = await buy(token, 6);
    expect(crossing.before.tier.id).toBe('base');
    expect(crossing.body.total).toBeGreaterThan(tiers[1].threshold);
    expect(crossing.body.pointsEarned).toBe(expectedPoints(crossing.body.total, 'base'));

    const promoted = await balance(token);
    expect(promoted.tier.id).toBe('plus');
    expect(promoted.tier.nameEn).toBe('4%');
    expect(promoted.tier.multiplier).toBe(2);
    expect(promoted.nextTier!.id).toBe('top');
    // Above the door there is no guarantee to give — only a projection.
    expect(promoted.nextTier!.visitsGuaranteed).toBe(false);

    // THE MONEY. The next invoice really is paid at twice the entry rate.
    const next = await buy(token);
    expect(next.body.pointsEarned).toBe(expectedPoints(next.body.total, 'plus'));
    expectRate(next.body.pointsEarned, next.body.total, 4);
  });

  it('S3b the visits door promotes at four distinct days, on a third of the spend', async () => {
    // SETUP INJECTED (there is no route that back-dates a sale), PAYOUT OVER
    // HTTP. Three small days in the past, then a real checkout today.
    const { token, id } = await enrol();
    const today = ammanDayKey(); // the business day, never the host's date
    for (const back of [3, 2, 1]) {
      await backend.recordSpend(id, 0.75, shiftDayKey(today, -back));
    }

    const banked = await balance(token);
    expect(banked.visitDays).toBe(3);
    expect(banked.windowSpend).toBeCloseTo(2.25, 6);
    expect(banked.tier.id).toBe('base'); // 2.25 JOD is nowhere near 20
    expect(banked.nextTier!.visitsRemaining).toBe(1);
    expect(banked.nextTier!.visitsGuaranteed).toBe(true);

    // The fourth distinct day, over HTTP. It is paid at the old rung...
    const fourth = await buy(token);
    expect(fourth.body.pointsEarned).toBe(expectedPoints(fourth.body.total, 'base'));

    // ... and the promotion the door promised actually happened, at a fraction
    // of the 20 JOD threshold. This is the door paying real money.
    const promoted = await balance(token);
    expect(promoted.visitDays).toBe(config.TIER2_VISITS_ALTERNATIVE);
    expect(promoted.windowSpend).toBeLessThan(tiers[1].threshold / 2);
    expect(promoted.tier.id).toBe('plus');

    const next = await buy(token);
    expect(next.body.pointsEarned).toBe(expectedPoints(next.body.total, 'plus'));
  });

  it('S4 crossing 65 JOD pays 6%, and there is nothing left to promise', async () => {
    const { token } = await enrol();
    await buy(token, 6);   // → plus
    await buy(token, 12);  // → over 65 JOD
    const top = await balance(token);
    expect(top.windowSpend).toBeGreaterThan(tiers[2].threshold);
    expect(top.tier.id).toBe('top');
    expect(top.tier.nameEn).toBe('6%');
    expect(top.tier.multiplier).toBe(3);
    expect(top.nextTier).toBeNull();

    const next = await buy(token);
    expect(next.body.pointsEarned).toBe(expectedPoints(next.body.total, 'top'));
    expectRate(next.body.pointsEarned, next.body.total, 6);
  });

  it('S5 90 days of silence empties the window and does NOT lower the rate', async () => {
    // THE DEFECT THIS ROUND EXISTS TO PREVENT, and its floor, in one walk. The
    // live programme ran 3,906 promotions and ZERO demotions in 980 days
    // because its qualifying spend never rolled off; here it rolls off and the
    // member keeps the rate they reached.
    //
    // Ageing the stored day keys is the injected half — 90 days of wall clock
    // is not available over HTTP. Everything asserted below is over HTTP.
    const { token, id } = await enrol();
    await buy(token, 6);
    await buy(token, 12);
    expect((await balance(token)).tier.id).toBe('top');

    const member = await backend.getMember(id);
    member.spend = member.spend.map((e) => ({ ...e, day: shiftDayKey(e.day, -200) }));

    const quiet = await balance(token);
    expect(quiet.windowSpend).toBe(0);   // the window really did roll off
    expect(quiet.visitDays).toBe(0);     // ... and so did the visit days
    expect(quiet.tier.id).toBe('top');   // ... and the rate did not
    expect(quiet.tier.multiplier).toBe(3);
    expect(quiet.nextTier).toBeNull();

    // THE FLOOR IS NOT JUST A BADGE. The next invoice on a zero-JOD window is
    // still paid at 6% — if the grant were recomputed from windowSpend alone
    // this member would silently drop to 2%.
    const next = await buy(token);
    expect(next.before.windowSpend).toBe(0);
    expect(next.body.pointsEarned).toBe(expectedPoints(next.body.total, 'top'));
  });

  it('S6 the voucher is redeemed exactly once, and a retry is not a second spend', async () => {
    const { token } = await enrolTreatment();
    const issued = (await checkout(token)).json().secondVisitVoucher;
    expect(issued).not.toBeNull();

    const before = await balance(token);
    const key = randomUUID();
    const redeem = (k: string) => app.inject({
      method: 'POST', url: '/v1/loyalty/voucher/redeem',
      payload: {}, headers: authOf(token, { 'idempotency-key': k }),
    });

    const first = await redeem(key);
    expect(first.statusCode).toBe(201);
    expect(first.json().redeemed).toBe(true);
    expect(first.json().voucher.used).toBe(true);
    expect(first.json().voucher.status).toBe('redeemed');
    expect(first.json().voucher.redeemedAt).not.toBeNull();

    // Same key → the stored response, byte for byte.
    const replay = await redeem(key);
    expect(replay.statusCode).toBe(201);
    expect(replay.body).toBe(first.body);
    expect(replay.headers['idempotent-replay']).toBe('true');

    // A FRESH key, so the idempotency plugin cannot be what refuses it: this is
    // the compare-and-set in the backend saying the row is already spent.
    const second = await redeem(randomUUID());
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe('voucher_already_redeemed');

    // The item is paid in kind. Redemption moves neither points nor wallet.
    const after = await balance(token);
    expect(after.points).toBe(before.points);
  });

  it('S7 a checkout retried with the same Idempotency-Key grants once', async () => {
    const { token } = await enrol();
    const key = randomUUID();

    const first = await checkout(token, 1, key);
    expect(first.statusCode).toBe(201);
    const retry = await checkout(token, 1, key);
    expect(retry.statusCode).toBe(201);
    expect(retry.body).toBe(first.body);          // same orderId, same voucher
    expect(retry.headers['idempotent-replay']).toBe('true');

    const after = await balance(token);
    expect(after.points).toBe(first.json().pointsEarned);
    expect(after.windowSpend).toBeCloseTo(first.json().total, 6);
    expect(after.visitDays).toBe(1);

    // One order, one ledger row — the grant did not happen twice behind the
    // replayed body.
    const history = (await app.inject({
      method: 'GET', url: '/v1/me/history', headers: authOf(token),
    })).json();
    expect(history).toHaveLength(1);
    expect(history[0].deltaPoints).toBe(first.json().pointsEarned);

    // ... and the guard is the KEY, not a cart-level dedupe: the same basket
    // under a new key is a second, real order.
    const again = await checkout(token, 1, randomUUID());
    expect(again.statusCode).toBe(201);
    expect(again.json().orderId).not.toBe(first.json().orderId);
    expect((await balance(token)).points).toBeGreaterThan(after.points);
  });

  it('S8 the app can actually consume what the server sends', async () => {
    // THE SEAM. `GET /v1/me/balance` is produced by the BFF and consumed by
    // almond-app's LoyaltyBalance, and the two shapes had already drifted with
    // nothing able to notice: the client cast the body instead of checking it,
    // so an object-vs-string `tier` silently resolved to the ENTRY rung and a
    // 6% member was rendered "2%" on four screens and quoted 2% in the cart.
    // Here the REAL bytes go through the shared parser and mapper, and the
    // result is checked against what the server actually paid.
    const { token } = await enrol();
    await buy(token, 6); // → the 4% rung
    const res = await app.inject({ method: 'GET', url: '/v1/me/balance', headers: authOf(token) });
    const view = toLoyaltyBalance(parseMeBalance(res.json()), 'u_smoke');

    expect(view.userId).toBe('u_smoke');
    // A TierId string the screens can match by identity — the whole point.
    expect(view.tier).toBe('plus');
    expect(tiers.find((t) => t.id === view.tier)).toBeDefined();
    expect(view.multiplier).toBe(2);
    expect(view.nextTier!.id).toBe('top');
    expect(view.nextTier!.visitsGuaranteed).toBe(false);
    // The two fields the PROMOTION CELEBRATION renders verbatim
    // (almond-app/lib/promotion.ts): `tier`, which it detects the rise on and
    // names in «مبروك! خصمك تضاعف — صرت على ٤٪», and the count in its second
    // clause, which it prints exactly as it arrives and never recomputes — a
    // second projection is the defect FINAL.md §2.1 removed. A zero or
    // fractional count here would silently drop half the approved sentence.
    expect(Number.isInteger(view.nextTier!.visitsRemaining)).toBe(true);
    expect(view.nextTier!.visitsRemaining).toBeGreaterThan(0);
    // The BFF keeps no cup state, and the type no longer pretends otherwise —
    // this used to be a required field that threw on two screens.
    expect(view.cup).toBeUndefined();

    // And the grant agrees with the rung the view will render.
    const next = await buy(token);
    expect(next.body.pointsEarned).toBe(
      Math.round(next.body.total * config.POINTS_PER_JOD * view.multiplier),
    );
  });

  it('S9 the code the member shows at the till is minted, signed and single-use', async () => {
    // THE WIRE NOBODY WAS USING. `POST /v1/pos/token` and the signed token
    // behind it have existed and been tested since before this walk; the Pay
    // screen built its own barcode anyway, out of a member id printed under the
    // QR. A unit test cannot see "nothing calls it" — this can.
    const { token: jwt, id } = await enrol();

    // It is member-authenticated. Anonymous minting would hand a code for
    // somebody's account to whoever asked, which is what the old screen did to
    // itself.
    const anon = await app.inject({ method: 'POST', url: '/v1/pos/token', payload: {} });
    expect(anon.statusCode).toBe(401);

    const res = await app.inject({
      method: 'POST', url: '/v1/pos/token', headers: authOf(jwt), payload: { mode: 'earn' },
    });
    expect(res.statusCode, res.body).toBe(200);

    // Read through the SHARED parser the phone uses, so a shape drift on this
    // route fails here rather than on a phone at a counter. It also refuses the
    // retired static format outright.
    const wire = parsePosToken(res.json());
    expect(wire.expiresIn).toBe(config.POS_TOKEN_TTL_SECONDS); // the shared dial, not a literal 60
    expect(wire.mode).toBe('earn');

    // FRESH ON EVERY ASK. The retired code was a pure function of the member id
    // and the toggle, so it was the same square forever; this one is not the
    // same square twice, which is what makes a photograph of it worthless.
    const second = parsePosToken((await app.inject({
      method: 'POST', url: '/v1/pos/token', headers: authOf(jwt), payload: { mode: 'earn' },
    })).json());
    expect(second.token).not.toBe(wire.token);

    // The till's half: the signature resolves to THIS member, with the mode the
    // member chose on their phone — and the second presentation of the same
    // code is refused, so a captured screen is spent the moment it is used.
    expect(verifyPosToken(wire.token)).toEqual({ memberId: id, mode: 'earn' });
    expect(() => verifyPosToken(wire.token)).toThrow(/already used/);

    // Default when the client says nothing: 'pay', the same thing the old
    // barcode said before the member touched the toggle.
    const plain = parsePosToken((await app.inject({
      method: 'POST', url: '/v1/pos/token', headers: authOf(jwt), payload: {},
    })).json());
    expect(plain.mode).toBe('pay');
    expect(verifyPosToken(plain.token).mode).toBe('pay');
  });

  it('S8b the parser refuses the shape the client used to assume', async () => {
    const { token } = await enrol();
    const wire = (await app.inject({
      method: 'GET', url: '/v1/me/balance', headers: authOf(token),
    })).json();

    // The exact historical mismatch: a bare TierId where the object goes. It
    // must THROW, not fall back — a silent fallback is how the defect hid.
    expect(() => parseMeBalance({ ...wire, tier: 'plus' })).toThrow(BalanceWireError);
    // A dropped guarantee flag would downgrade every definite sentence to a
    // hedge with nothing to notice.
    expect(() => parseMeBalance({
      ...wire, nextTier: { ...wire.nextTier, visitsGuaranteed: undefined },
    })).toThrow(BalanceWireError);
    // A rung id no shipped tier can name.
    expect(() => parseMeBalance({ ...wire, tier: { ...wire.tier, id: 'gold' } })).toThrow(BalanceWireError);
    // A 404/HTML body, which is what the live client would receive today.
    expect(() => parseMeBalance('<html>404</html>')).toThrow(BalanceWireError);
  });

  it('S10 the basket the offers card builds earns the combo bonus it advertises', async () => {
    /**
     * The offers-page card (almond-app/components/home/ComboOfferCard.tsx) is
     * the first surface that states the combo to a member with no basket, and
     * its one tap ADDS A SPECIFIC PAIR — `getComboStarter()` — and sends them to
     * the cart. That pair is chosen on the phone by `categoryKind`; the grant is
     * priced on the server by `comboPairs`, through `reprice` in
     * bff/src/pricing.ts, from an itemId and a sizeId over HTTP.
     *
     * Nothing else in this repo joins those two halves. The app tests assert the
     * suggestion satisfies `comboPairs()` in-process; the earn tests assert
     * computeEarn prices a pair. Neither can see a pair the CHECKOUT ROUTE fails
     * to recognise — an item id the server cannot resolve, a size the schema
     * rejects, a classifier that disagrees across the seam. If any of those
     * broke, the card would promise points the till would not pay.
     */
    const starter = getComboStarter();
    expect(starter, 'the offers card has no pair to suggest').not.toBeNull();
    const { drink, drinkSize, food, foodSize } = starter!;

    const pairLines = [
      { itemId: drink.id, sizeId: drinkSize.id, optionIds: [] as string[], qty: 1 },
      { itemId: food.id, sizeId: foodSize.id, optionIds: [] as string[], qty: 1 },
    ];

    const { token } = await enrol();
    const before = await balance(token);
    expect(before.tier.id).toBe('base');

    const res = await app.inject({
      method: 'POST',
      url: '/v1/checkout',
      payload: { branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash', lines: pairLines },
      headers: authOf(token, { 'idempotency-key': randomUUID() }),
    });
    expect(res.statusCode, res.body).toBe(201);
    const body = res.json();

    // The offer written out: the rung's rate on the invoice, PLUS the flat
    // combo grant. Stated against config, not re-derived with computeEarn.
    expect(body.pointsEarned).toBe(
      expectedPoints(body.total, before.tier.id) + config.COMBO_BONUS_POINTS,
    );

    // ... and the bonus really is the pair, not something the basket size
    // bought: the same drink alone, at the same rung, earns exactly
    // COMBO_BONUS_POINTS fewer per JOD-matched invoice.
    const solo = await enrol();
    const soloRes = await app.inject({
      method: 'POST',
      url: '/v1/checkout',
      payload: {
        branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash',
        lines: [pairLines[0]],
      },
      headers: authOf(solo.token, { 'idempotency-key': randomUUID() }),
    });
    expect(soloRes.statusCode, soloRes.body).toBe(201);
    const soloBody = soloRes.json();
    expect(soloBody.pointsEarned).toBe(expectedPoints(soloBody.total, 'base'));
    expect(body.pointsEarned - soloBody.pointsEarned).toBe(
      expectedPoints(body.total, 'base') - expectedPoints(soloBody.total, 'base')
      + config.COMBO_BONUS_POINTS,
    );

    // 🔴 THE COST NOTE, pinned rather than written down somewhere. There is no
    // per-invoice pair cap: `comboPairs` is min(drinks, foods), so a basket of
    // four drinks and four foods grants four times the bonus. The whole cost
    // model rests on 35% of invoices containing a pair — the figure this card
    // exists to raise (at 50% the programme is ~21,109 JOD/yr and at 65%
    // ~23,867, against ~18,999 for the programme it replaces). A cap is an
    // OFFER change and is the owner's; this assertion is here so that adding
    // one is a deliberate act with a test to update, not a silent one.
    const bulk = await enrol();
    const bulkRes = await app.inject({
      method: 'POST',
      url: '/v1/checkout',
      payload: {
        branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash',
        lines: pairLines.map((l) => ({ ...l, qty: 4 })),
      },
      headers: authOf(bulk.token, { 'idempotency-key': randomUUID() }),
    });
    // Asserted before the body is read: a 400 here would otherwise surface as
    // "expected undefined to be 250" and read like an arithmetic failure.
    expect(bulkRes.statusCode, bulkRes.body).toBe(201);
    const bulkBody = bulkRes.json();
    expect(bulkBody.pointsEarned).toBe(
      expectedPoints(bulkBody.total, 'base') + 4 * config.COMBO_BONUS_POINTS,
    );
  });
});
