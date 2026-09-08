import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { config } from '@almond/shared/config';
import { menuItems } from '@almond/shared/menu';
import { basketHasDrink } from '@almond/shared/lib/combo';
import { itemKind } from '@almond/shared/lib/categoryKind';
import {
  assignHoldout, holdoutSpecFromConfig, receivesTreatment, type HoldoutStamp,
} from '@almond/shared/loyalty/holdout';
import {
  SECOND_VISIT_PROGRAMME, decideSecondVisit, secondVisitExpiresAt,
  secondVisitRulesFromConfig, secondVisitStatus, toSecondVisitView,
  type SecondVisitInput, type SecondVisitRules, type SecondVisitVoucher,
  type SecondVisitVoucherView, type SecondVisitViewIsAVoucher,
} from '@almond/shared/loyalty/secondVisit';
import type { CartItem, Voucher } from '@almond/shared/types';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import type { Backend } from '../src/backend';
import { collectSources } from './lib/sources';
import { signIn } from './lib/signIn';

/**
 * T32 — the second-visit voucher (BRIEF §3 W2).
 *
 * `config.SECOND_VISIT_VOUCHER` was declared and nothing read it. This suite
 * asserts the OUTCOME a member gets, not the mechanism that produced it:
 * whether a voucher lands on the wire, whether it can be spent twice, and
 * whether a control-arm member can tell they are in the control arm.
 *
 * T1-T15, T24, T27, T29, T30 (holdout) and T31 (window) are taken; this file
 * claims T32.
 */

const SPEC = holdoutSpecFromConfig('secondVisitVoucher');
const RULES = secondVisitRulesFromConfig();

/** W3's checked-in fixtures. m_3/m_5/m_8 are holdout; demo and m_0 are not. */
const HOLDOUT_KEYS = ['m_3', 'm_5', 'm_8'];
const TREATMENT_KEYS = ['demo', 'm_0'];

/** A real drink and a real not-a-drink, both chosen from the shipped menu by
 *  the same classifier production uses. */
const DRINK = menuItems.find((m) => itemKind(m.id) === 'drink' && m.inStock !== false && m.sizes[0]?.price > 0)!;
/** 250 g of retail beans: `isDrink === true` on the record, `itemKind 'other'`
 *  in reality. This is the 14-of-83 case (see T32l). */
const BEANS = menuItems.find((m) => m.id === 'espresso-blend-250-gm-specialty-coffee')!;

const lineOf = (id: string) => {
  const item = menuItems.find((m) => m.id === id)!;
  return { itemId: item.id, sizeId: item.sizes[0].id, optionIds: [] as string[], qty: 1 };
};

let app: FastifyInstance;
let backend: Backend;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auth = (token: string, extra: Record<string, string> = {}): any =>
  ({ authorization: `Bearer ${token}`, ...extra });

async function checkout(token: string, itemId: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/checkout',
    payload: {
      branchId: 'b1', orderType: 'pickup', paymentMethod: 'cash', lines: [lineOf(itemId)],
    },
    headers: auth(token, { 'idempotency-key': randomUUID() }),
  });
}

let phoneSeq = 100;
const nextPhone = (): string => `+96279${String(++phoneSeq).padStart(7, '0')}`;

/** Enrol a brand-new member and return their token and id. */
async function enrol(): Promise<{ token: string; id: string; phone: string }> {
  const phone = nextPhone();
  const token = await signIn(app, phone);
  const id = (await backend.findOrCreateByPhone(phone)).id;
  return { token, id, phone };
}

/**
 * Enrol members until one lands in the TREATMENT arm.
 *
 * A route-level test cannot choose an arm: bff/src/backend/memory.ts mints
 * `m_${randomUUID()}` at first sign-in, so the id — and with it the arm — is
 * not addressable from outside. Enrolling until one lands in the treatment arm
 * is the honest way to obtain one; at the configured 2000 bp share the expected
 * number of attempts is 1.25 and 40 attempts all landing in the holdout has
 * probability 1.1e-28. The SUPPRESSION half of the pair is asserted where it
 * CAN be chosen — on the pure decision, against W3's checked-in fixtures
 * (T32p).
 */
async function enrolTreatment(): Promise<{ token: string; id: string }> {
  for (let i = 0; i < 40; i++) {
    const m = await enrol();
    if (receivesTreatment(assignHoldout(m.id, SPEC))) return m;
  }
  throw new Error('40 consecutive members landed in the holdout — the share is wrong');
}

/** Build a decision input with every guard open, so each test flips exactly
 *  the one thing it is about. */
function input(over: Partial<SecondVisitInput> = {}): SecondVisitInput {
  return {
    memberId: 'm_test',
    orderId: 'ord_test',
    voucherId: 'svv_test',
    basketHasDrink: true,
    arm: assignHoldout('demo', SPEC), // a checked-in TREATMENT fixture
    alreadyEvaluated: false,
    priorTransactions: 0,
    unexplainedPoints: 0,
    priorWindowSpend: 0,
    at: new Date('2026-09-08T09:00:00Z'),
    ...over,
  };
}

beforeAll(async () => {
  // Our own backend, so a test can read the rows the routes never expose:
  // 'suppressed', 'declined' and 'ineligible' are deliberately invisible on the
  // wire, and asserting they were WRITTEN is the only way to prove the
  // difference between "withheld" and "never evaluated".
  backend = createMemoryBackend();
  app = await build(backend);
});
afterAll(async () => { await app.close(); });

// ---------------------------------------------------------------------------
// T32a/b/c/d — issuance, and the three ways it is refused.
// ---------------------------------------------------------------------------
describe('T32a a first identified drink purchase issues the voucher', () => {
  it('puts a live voucher on the checkout response and writes exactly one row', async () => {
    const m = await enrolTreatment();
    const r = await checkout(m.token, DRINK.id);
    expect(r.statusCode).toBe(201);
    const v = r.json().secondVisitVoucher as SecondVisitVoucherView | null;

    // 🔴 THIS ASSERTION IS ALSO THE §3.2 ORDERING GUARD. The evaluation runs at
    // saga step 4, BEFORE computeEarn/addPoints/recordSpend, because
    // memory.ts's must() hands back the stored Member and addPoints mutates it
    // in place. Moved below the grant, the pre-existing-balance guard would
    // read a POST-grant balance, every new member would look like a migrated
    // one, and nobody would ever be issued a voucher. This line goes red the
    // moment the call moves.
    expect(v, 'a new member paying for a drink must be issued the voucher').not.toBeNull();
    expect(v!.status).toBe('active');
    expect(v!.type).toBe('free-item');
    expect(v!.used).toBe(false);
    expect(v!.titleEn).toBe(config.SECOND_VISIT_VOUCHER.labelEn);
    // No JOD figure on the card: the item is paid IN KIND (0.399 JOD of
    // material against a 1.90 JOD menu price, 4.8× leverage), and a value would
    // invite exactly the cashback framing that argument rejects.
    expect(v as unknown as { value?: number }).not.toHaveProperty('value');

    const row = await backend.getSecondVisitVoucher(m.id);
    expect(row!.outcome).toBe('issued');
    expect(row!.programme).toBe(SECOND_VISIT_PROGRAMME);
    expect(row!.basketHadDrink).toBe(true);
    expect(row!.redeemedAt).toBeNull();
  });

  it('records the arm on the row it writes, whatever the arm is', async () => {
    // No enrolment loop here: this holds for EVERY new member, so it cannot be
    // flaky, and it is the assertion that says a suppressed member was
    // evaluated rather than skipped.
    const m = await enrol();
    const r = await checkout(m.token, DRINK.id);
    expect(r.statusCode).toBe(201);
    const row = await backend.getSecondVisitVoucher(m.id);
    expect(row, 'every first identified transaction must leave a row').not.toBeNull();
    expect(row!.arm.experiment).toBe(SPEC.experiment);
    expect(row!.arm.saltId).toBe(SPEC.saltId);
    // The outcome is 'issued' on exactly the treatment arm — the OUTCOME
    // assertion W3 could not write for itself.
    expect(row!.outcome).toBe(receivesTreatment(assignHoldout(m.id, SPEC)) ? 'issued' : 'suppressed');
  });
});

describe('T32b one per member, ever', () => {
  it('a second drink purchase issues nothing and does not overwrite the row', async () => {
    const m = await enrolTreatment();
    const first = await checkout(m.token, DRINK.id);
    const row1 = await backend.getSecondVisitVoucher(m.id);
    expect(first.json().secondVisitVoucher).not.toBeNull();

    const second = await checkout(m.token, DRINK.id);
    expect(second.statusCode).toBe(201);
    expect(second.json().secondVisitVoucher).toBeNull();
    const row2 = await backend.getSecondVisitVoucher(m.id);
    // Same row, untouched. An overwrite is how "one per member, ever" silently
    // becomes "one per member, per visit".
    expect(row2!.id).toBe(row1!.id);
    expect(row2!.issuedAt).toBe(row1!.issuedAt);
    expect(row2!.issuedOnOrderId).toBe(row1!.issuedOnOrderId);
  });
});

describe('T32c the drink condition is evaluated exactly once', () => {
  it('a drinkless first basket is declined permanently, drink or no drink later', async () => {
    const m = await enrolTreatment();
    const first = await checkout(m.token, BEANS.id);
    expect(first.statusCode).toBe(201);
    expect(first.json().secondVisitVoucher).toBeNull();
    const row = await backend.getSecondVisitVoucher(m.id);
    expect(row!.outcome).toBe('declined');
    expect(row!.basketHadDrink).toBe(false);
    expect(row!.expiresAt).toBeNull();

    // No second chance. The voucher is priced against the 45.8% hazard at the
    // 1→2 step; every later step is 68-93%, so issuing on visit 5 spends the
    // same in-kind cost where the member returns anyway 9 times in 10.
    const later = await checkout(m.token, DRINK.id);
    expect(later.json().secondVisitVoucher).toBeNull();
    expect((await backend.getSecondVisitVoucher(m.id))!.outcome).toBe('declined');
  });
});

describe('T32d the migration guard — the 19,040 JOD line', () => {
  it('a member holding a balance the BFF never granted is ineligible', async () => {
    // The seeded demo member holds 240 points and a real 90-day spend log that
    // no BFF checkout produced. Every one of the 47,720 live members is in that
    // position — their history is in Wafii/Odoo, not in the BFF's order log —
    // and ungated each one's next drink is a "first identified transaction":
    // 47,720 × 0.399 JOD of material = 19,040 JOD against a programme costed at
    // 921-1,600 JOD/yr.
    const token = await signIn(app, '0790000000');
    const before = await backend.getMember('demo');
    expect(before.points, 'the fixture must carry a pre-existing balance').toBeGreaterThan(0);

    const r = await checkout(token, DRINK.id);
    expect(r.statusCode).toBe(201);
    expect(r.json().secondVisitVoucher).toBeNull();
    expect((await backend.getSecondVisitVoucher('demo'))!.outcome).toBe('ineligible');
  });

  it('each of the three guards refuses on its own', () => {
    for (const over of [
      { priorTransactions: 1 },
      { unexplainedPoints: 1 },
      { priorWindowSpend: 0.5 },
    ]) {
      expect(decideSecondVisit(input(over), RULES).row!.outcome, JSON.stringify(over)).toBe('ineligible');
    }
    // …and with all three clear, the same member IS issued. Otherwise the test
    // above would pass on a rule that refuses everybody.
    expect(decideSecondVisit(input(), RULES).row!.outcome).toBe('issued');
  });
});

// ---------------------------------------------------------------------------
// T32p — THE OUTCOME ASSERTION W3 COULD NOT WRITE.
//
// W3 records the arm and proves the API cannot be read backwards syntactically;
// nothing there stops `if (receivesTreatment(a)) withhold()`. Only an assertion
// on what the member GETS catches an inverted gate, and it needs W3's
// checked-in fixtures — which is why this test is here and not there.
// ---------------------------------------------------------------------------
describe('T32p the treatment is withheld from the control arm, and only from it', () => {
  it('issues to exactly the members W3 pinned as treatment', () => {
    for (const key of TREATMENT_KEYS) {
      const d = decideSecondVisit(input({ arm: assignHoldout(key, SPEC) }), RULES);
      expect(d.row!.outcome, `${key} is a checked-in TREATMENT fixture`).toBe('issued');
      expect(d.row!.expiresAt).not.toBeNull();
    }
    for (const key of HOLDOUT_KEYS) {
      const d = decideSecondVisit(input({ arm: assignHoldout(key, SPEC) }), RULES);
      expect(d.row!.outcome, `${key} is a checked-in HOLDOUT fixture`).toBe('suppressed');
      // A suppressed row has nothing to expire and nothing to redeem.
      expect(d.row!.expiresAt).toBeNull();
      expect(toSecondVisitView(d.row, input().at)).toBeNull();
    }
  });

  it('over 500 members the issued set is exactly the treatment set', () => {
    let issued = 0;
    for (let i = 0; i < 500; i++) {
      const arm = assignHoldout(`m_${i}`, SPEC);
      const outcome = decideSecondVisit(input({ arm }), RULES).row!.outcome;
      expect(outcome === 'issued').toBe(receivesTreatment(arm));
      if (outcome === 'issued') issued++;
    }
    // ~80% at the configured 2000 bp share. A wide band, because the point is
    // the direction: an INVERTED gate lands near 100 (20%), not near 400.
    expect(issued).toBeGreaterThan(330);
    expect(issued).toBeLessThan(460);
  });
});

describe('T32q eligibility is decided before the arm, on purpose', () => {
  it('a holdout member with a drinkless basket is declined, not suppressed', () => {
    // docs/LOYALTY-ODOO-MODULE.md:362 says the holdout short-circuit is line
    // one. That is right for the earn formula, where every member is eligible
    // by construction, and WRONG here: arm-first would record this member as a
    // control-arm observation for a treatment that was never available to them.
    // The control arm would then contain people the treatment arm cannot
    // contain and the two stop being comparable — which defeats the reason the
    // holdout exists at all.
    const d = decideSecondVisit(
      input({ arm: assignHoldout('m_3', SPEC), basketHasDrink: false }), RULES,
    );
    expect(d.row!.outcome).toBe('declined');
    // The arm is still STORED on the row — store always, branch last — so an
    // analyst can check arm balance across the whole evaluated population.
    expect(d.row!.arm.bucket).toBe(assignHoldout('m_3', SPEC).bucket);
  });

  it('an ineligible member is never counted as a control-arm observation', () => {
    const d = decideSecondVisit(
      input({ arm: assignHoldout('m_5', SPEC), unexplainedPoints: 240 }), RULES,
    );
    expect(d.row!.outcome).toBe('ineligible');
  });
});

describe('T32r the two ways no row is written', () => {
  it('a disabled programme writes nothing, so the member can still be evaluated later', () => {
    const off: SecondVisitRules = { ...RULES, enabled: false };
    const d = decideSecondVisit(input(), off);
    expect(d.row).toBeNull();
    expect(d.skipped).toBe('disabled');
  });

  it('an already-evaluated member writes nothing', () => {
    const d = decideSecondVisit(input({ alreadyEvaluated: true }), RULES);
    expect(d.row).toBeNull();
    expect(d.skipped).toBe('already-evaluated');
  });
});

// ---------------------------------------------------------------------------
// T32e/j — holdout blindness: three server-side situations, one client answer.
// ---------------------------------------------------------------------------
describe('T32e a suppressed member cannot tell they are suppressed', () => {
  it('sees the same body as a member with no row at all', async () => {
    const suppressed = await enrol();
    // The arm is INJECTED here because a route cannot pick one (see
    // enrolTreatment). m_3 is W3's checked-in holdout fixture.
    const issued = await backend.evaluateSecondVisitVoucher({
      memberId: suppressed.id, orderId: `ord_${randomUUID()}`,
      basketHasDrink: true, arm: assignHoldout('m_3', SPEC), at: new Date(),
    });
    expect(issued, 'a holdout member is issued nothing').toBeNull();
    expect((await backend.getSecondVisitVoucher(suppressed.id))!.outcome).toBe('suppressed');

    const never = await enrol();
    const a = await app.inject({ method: 'GET', url: '/v1/me/voucher', headers: auth(suppressed.token) });
    const b = await app.inject({ method: 'GET', url: '/v1/me/voucher', headers: auth(never.token) });
    expect(a.statusCode).toBe(200);
    // Byte-identical. A distinct code — even a helpful one — would tell a
    // curious member which arm they are in, and a control arm that knows it is
    // one is not a control arm.
    expect(a.body).toBe(b.body);
    expect(a.json()).toEqual({ voucher: null });
  });
});

describe('T32j redeem answers absent, declined and suppressed identically', () => {
  it('returns one indistinguishable 404 in all four situations', async () => {
    const never = await enrol();

    const declined = await enrol();
    await checkout(declined.token, BEANS.id);
    expect((await backend.getSecondVisitVoucher(declined.id))!.outcome).toBe('declined');

    const suppressed = await enrol();
    await backend.evaluateSecondVisitVoucher({
      memberId: suppressed.id, orderId: `ord_${randomUUID()}`,
      basketHasDrink: true, arm: assignHoldout('m_5', SPEC), at: new Date(),
    });

    const ineligible = await enrol();
    // Qualifying spend the BFF's own order log cannot explain — the shape a
    // migrated member arrives in. NOT `addPoints`: points the BFF granted
    // itself are no longer evidence of an unseen history (see T32u), so seeding
    // a balance through the ledger would leave this member ELIGIBLE and the
    // assertion below would be measuring the wrong situation.
    await backend.recordSpend(ineligible.id, 5);
    await backend.evaluateSecondVisitVoucher({
      memberId: ineligible.id, orderId: `ord_${randomUUID()}`,
      basketHasDrink: true, arm: assignHoldout('demo', SPEC), at: new Date(),
    });
    expect((await backend.getSecondVisitVoucher(ineligible.id))!.outcome).toBe('ineligible');

    const bodies = new Set<string>();
    for (const m of [never, declined, suppressed, ineligible]) {
      const r = await app.inject({
        method: 'POST', url: '/v1/loyalty/voucher/redeem',
        headers: auth(m.token, { 'idempotency-key': randomUUID() }),
      });
      expect(r.statusCode).toBe(404);
      bodies.add(r.body);
    }
    expect(bodies.size, `four situations produced ${bodies.size} bodies: ${[...bodies].join(' | ')}`).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// T32f/g/h — redemption cannot be double-spent.
// ---------------------------------------------------------------------------
describe('T32f/g/h redemption is idempotent and cannot be double-spent', () => {
  async function memberWithVoucher(): Promise<{ token: string; id: string }> {
    const m = await enrolTreatment();
    const r = await checkout(m.token, DRINK.id);
    expect(r.json().secondVisitVoucher).not.toBeNull();
    return m;
  }
  const redeem = (token: string, key: string) => app.inject({
    method: 'POST', url: '/v1/loyalty/voucher/redeem',
    headers: auth(token, { 'idempotency-key': key }),
  });

  it('T32f the same Idempotency-Key replays the first 201 and spends nothing twice', async () => {
    const m = await memberWithVoucher();
    const key = randomUUID();
    const r1 = await redeem(m.token, key);
    const r2 = await redeem(m.token, key);
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    expect(r2.headers['idempotent-replay']).toBe('true');
    expect(r2.json().voucher.redeemedAt).toBe(r1.json().voucher.redeemedAt);
    expect(r1.json().voucher.status).toBe('redeemed');
    expect(r1.json().voucher.used).toBe(true);
  });

  it('T32g a DIFFERENT key on a spent voucher is a 409 — the case idempotency cannot cover', async () => {
    const m = await memberWithVoucher();
    expect((await redeem(m.token, randomUUID())).statusCode).toBe(201);
    // idempotency.ts keys on memberId:METHOD:url:key, so a client retrying with
    // a NEW key bypasses the plugin entirely. It is retry safety, never the
    // spend guard.
    const again = await redeem(m.token, randomUUID());
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe('voucher_already_redeemed');
  });

  it('T32h eight redemptions dispatched in one burst hand over exactly one item', async () => {
    const m = await memberWithVoucher();
    // 🔴 THIS CALLS THE BACKEND DIRECTLY, AND THAT IS THE POINT. Eight
    // app.inject() calls do not reliably suspend at the same place, so a
    // route-level race passes whether or not the critical section is safe —
    // it proves nothing. Eight calls started in ONE SYNCHRONOUS BURST do: the
    // method body runs synchronously to its first await, so if there is none,
    // call 1 has already written redeemedAt before call 2 begins. Insert an
    // await between the CHECK of redeemedAt and the WRITE of it — a log line,
    // an audit call — and all eight suspend having seen null, then all eight
    // write. Verified by mutation: `await Promise.resolve()` on that exact line
    // turns this red with EIGHT successes, i.e. eight pastries.
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => backend.redeemSecondVisitVoucher(m.id, new Date())),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const clash = results.filter((r) => r.status === 'rejected');
    expect(ok.length, `exactly one redemption may succeed, got ${ok.length}`).toBe(1);
    expect(clash.length).toBe(7);
    for (const r of clash) {
      expect((r as PromiseRejectedResult).reason).toMatchObject({ code: 'voucher_already_redeemed' });
    }
  });

  it('T32h2 the route surfaces the same race as one 201 and seven 409s', async () => {
    const m = await memberWithVoucher();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => redeem(m.token, randomUUID())),
    );
    const ok = results.filter((r) => r.statusCode === 201);
    const clash = results.filter((r) => r.statusCode === 409);
    expect(ok.length, 'exactly one redemption may succeed').toBe(1);
    expect(clash.length).toBe(7);
    for (const r of clash) expect(r.json().error).toBe('voucher_already_redeemed');
    expect((await backend.getSecondVisitVoucher(m.id))!.redeemedAt).toBe(ok[0].json().voucher.redeemedAt);
  });

  it('T32k redemption moves neither points nor wallet balance', async () => {
    const m = await memberWithVoucher();
    const read = async () => {
      const b = (await app.inject({ method: 'GET', url: '/v1/me/balance', headers: auth(m.token) })).json();
      const w = (await app.inject({ method: 'GET', url: '/v1/me/wallet', headers: auth(m.token) })).json();
      return { points: b.points, wallet: w.balance };
    };
    const before = await read();
    expect((await redeem(m.token, randomUUID())).statusCode).toBe(201);
    // The whole economic argument is that the item is paid IN KIND: a 1.90 JOD
    // pastry at 79% margin costs 0.399 JOD of material — 4.8× leverage, 12.5×
    // for a 92%-margin sweet, against cashback's 1.0×. Paying it in points
    // would convert a 4.8× lever into a 1.0× one.
    expect(await read()).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// T32i — expiry is derived, never stored.
// ---------------------------------------------------------------------------
describe('T32i expiry needs no writer', () => {
  it('a voucher issued 31 days ago is expired, and redeeming it is a 409', async () => {
    const m = await enrolTreatment();
    const issuedAt = new Date(Date.now() - 31 * 86400000);
    const row = await backend.evaluateSecondVisitVoucher({
      memberId: m.id, orderId: `ord_${randomUUID()}`,
      basketHasDrink: true, arm: assignHoldout(m.id, SPEC), at: issuedAt,
    });
    expect(row!.outcome).toBe('issued');

    const r = await app.inject({
      method: 'POST', url: '/v1/loyalty/voucher/redeem',
      headers: auth(m.token, { 'idempotency-key': randomUUID() }),
    });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toBe('voucher_expired');
    // Nothing was written to make it expired: the row still says 'issued'.
    // There is no cron in the BFF, so a stored `expired` flag would keep saying
    // 'issued' months past expiry — a lie only a scheduled job could correct.
    const stored = (await backend.getSecondVisitVoucher(m.id))!;
    expect(stored.outcome).toBe('issued');
    expect(stored.redeemedAt).toBeNull();
    expect(secondVisitStatus(stored, new Date())).toBe('expired');
    // …and the same row read one day BEFORE its expiry is still active.
    expect(secondVisitStatus(stored, new Date(Date.parse(stored.expiresAt!) - 86400000))).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// T32l/m/n — the config and the classifier the rule actually rests on.
// ---------------------------------------------------------------------------
describe('T32l the drink test is itemKind, not item.isDrink', () => {
  const cart = (id: string): CartItem[] => ([{
    lineId: `l_${id}`, itemId: id, nameAr: '', nameEn: '', sizeId: 'M',
    sizeNameAr: '', sizeNameEn: '', unitBasePrice: 1, customizations: [], qty: 1,
  } as unknown as CartItem]);

  it('a basket of 250 g retail beans contains no drink, though the record says isDrink', () => {
    expect(BEANS.isDrink, 'the fixture must be one of the 14 mislabelled items').toBe(true);
    expect(basketHasDrink(cart(BEANS.id))).toBe(false);
    expect(basketHasDrink(cart(DRINK.id))).toBe(true);
  });

  it('every itemKind drink is flagged, but 14 flagged items are not drinks', () => {
    // Measured over the shipped menu: 267 items, 83 carry isDrink, 69 classify
    // as 'drink', and the 69 are a strict subset of the 83. The 14 extras are
    // seven retail coffee bags, a V60 dripper, a V60 craft maker, V60 PAPER
    // FILTERS, three granola cups and a chia pudding. `item.isDrink` would
    // issue "the second one's on us" on a pack of paper filters.
    const flagged = menuItems.filter((m) => m.isDrink === true);
    const drinks = menuItems.filter((m) => itemKind(m.id) === 'drink');
    expect(drinks.every((d) => d.isDrink === true)).toBe(true);
    expect(flagged.length - drinks.length).toBeGreaterThan(0);
    expect(menuItems.some((m) => m.isDrink === true && itemKind(m.id) !== 'drink')).toBe(true);
  });

  it('a zero-quantity drink line is not a drink', () => {
    expect(basketHasDrink([{ ...cart(DRINK.id)[0], qty: 0 }])).toBe(false);
  });
});

describe('T32m the 30 days come from config, and only from config', () => {
  it('expiresAt − issuedAt is exactly windowDays', () => {
    const at = new Date('2026-09-08T21:30:00Z');
    const row = decideSecondVisit(input({ at }), RULES).row!;
    expect(Date.parse(row.expiresAt!) - at.getTime()).toBe(RULES.windowDays * 86400000);
    expect(secondVisitExpiresAt(at, RULES.windowDays)).toBe(row.expiresAt);
    // Asia/Amman is UTC+3 year-round (Jordan abolished DST in 2022), so
    // windowDays × 86.4e6 ms is exactly windowDays Amman calendar days and the
    // comparison is timezone-free by construction. The DISPLAYED date still
    // goes through ammanDayKey.
    expect(toSecondVisitView(row, at)!.expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('exactly two source files read config.SECOND_VISIT_VOUCHER', () => {
    // Not a ban on the literal 30 — `86400000 * 30` appears legitimately all
    // over the app's fixtures. The invariant that matters is that the rule has
    // ONE reader: a second one is how the app and the BFF came to disagree
    // about the earn rate (D2), and it is what T7 exists to prevent for points.
    const ALLOWED = new Set([
      'packages/shared/src/config/index.ts',      // the declaration
      'packages/shared/src/loyalty/secondVisit.ts', // the one reader
    ]);
    const offenders: string[] = [];
    for (const f of collectSources()) {
      if (ALLOWED.has(f.path)) continue;
      f.code.forEach((line, i) => {
        if (/\bSECOND_VISIT_VOUCHER\b/.test(line)) offenders.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
      });
    }
    expect(
      offenders,
      'read the rule through secondVisitRulesFromConfig() — a second reader is'
      + ` how two modules come to disagree about it. Offending lines: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });
});

describe('T32n the storage model and the config agree', () => {
  it('oncePerMember is true, which the one-row-per-member key assumes', () => {
    // The memory backend keys vouchers by memberId and Odoo's form is
    // UNIQUE(partner_id). Flipping this flag would not change either, so it
    // would silently mean nothing — this test is what makes the flag honest.
    expect(config.SECOND_VISIT_VOUCHER.oncePerMember).toBe(true);
    expect(config.SECOND_VISIT_VOUCHER.requiresDrink).toBe(RULES.requiresDrink);
    expect(config.SECOND_VISIT_VOUCHER.windowDays).toBe(RULES.windowDays);
  });
});

// ---------------------------------------------------------------------------
// T32o — nothing on the wire names an arm.
// ---------------------------------------------------------------------------
describe('T32o the arm never reaches the member', () => {
  /** Every key name anywhere in a JSON body, lower-cased. */
  function keysOf(value: unknown, out: string[] = []): string[] {
    if (Array.isArray(value)) value.forEach((v) => keysOf(v, out));
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) { out.push(k.toLowerCase()); keysOf(v, out); }
    }
    return out;
  }

  it('no checkout, voucher or redeem body carries an arm, an outcome or a bucket', async () => {
    const m = await enrolTreatment();
    const co = await checkout(m.token, DRINK.id);
    const get = await app.inject({ method: 'GET', url: '/v1/me/voucher', headers: auth(m.token) });
    const red = await app.inject({
      method: 'POST', url: '/v1/loyalty/voucher/redeem',
      headers: auth(m.token, { 'idempotency-key': randomUUID() }),
    });
    expect([co.statusCode, get.statusCode, red.statusCode]).toEqual([201, 200, 201]);

    for (const res of [co, get, red]) {
      const lower = res.body.toLowerCase();
      for (const word of ['holdout', 'treatment', 'suppressed', 'declined', 'ineligible', 'bucket']) {
        expect(lower, `a response body leaked "${word}": ${res.body}`).not.toContain(word);
      }
      // The string check above misses a renamed KEY holding an arm; this misses
      // a renamed VALUE. Together they cover both halves.
      const keys = keysOf(res.json());
      for (const k of ['arm', 'outcome', 'programme', 'baskethaddrink']) {
        expect(keys, `a response body carries "${k}": ${res.body}`).not.toContain(k);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The handoff to W4 — the view renders in the component that already exists.
// ---------------------------------------------------------------------------
describe('T32s the view is a Voucher', () => {
  it('is structurally assignable to the existing Voucher type', () => {
    const proof: SecondVisitViewIsAVoucher = true;
    expect(proof).toBe(true);
    const row: SecondVisitVoucher = decideSecondVisit(input(), RULES).row!;
    const view = toSecondVisitView(row, input().at)!;
    // Compile-time: if a field is ever renamed, this line fails the typecheck
    // rather than the phone. almond-app/components/loyalty/VoucherCard.tsx then
    // needs no new component.
    const asVoucher: Voucher = view;
    expect(asVoucher.type).toBe('free-item');
    expect(asVoucher.titleAr).toBe(config.SECOND_VISIT_VOUCHER.labelAr);
  });

  it('shows a redeemed voucher as used and an expired one as expired', () => {
    const at = new Date('2026-09-08T09:00:00Z');
    const row = decideSecondVisit(input({ at }), RULES).row!;
    const redeemed: SecondVisitVoucher = { ...row, redeemedAt: at.toISOString() };
    expect(toSecondVisitView(redeemed, at)!.status).toBe('redeemed');
    expect(toSecondVisitView(redeemed, at)!.used).toBe(true);
    const later = new Date(Date.parse(row.expiresAt!) + 1);
    expect(toSecondVisitView(row, later)!.status).toBe('expired');
  });
});

/** Used only so the HoldoutStamp import is load-bearing rather than decorative:
 *  the row stores the whole stamp, not a boolean, so it stays replayable. */
describe('T32t the row stores the stamp, not a boolean', () => {
  it('keeps enough on the row to re-derive the arm after the fact', () => {
    const arm: HoldoutStamp = assignHoldout('m_10', SPEC);
    const row = decideSecondVisit(input({ arm }), RULES).row!;
    // m_10 sits at bucket 910,747,998 = 21.2050% of the space: treatment at
    // 2000 bp, HOLDOUT at 2500. A single basis-point edit would silently
    // re-label it — which is why the bucket and the threshold that decided it
    // are both on the row, and why a boolean would not have been enough.
    expect(row.arm.bucket).toBe(910747998);
    expect(row.arm.threshold).toBe(arm.threshold);
    expect(row.arm.holdoutShareBp).toBe(SPEC.holdoutShareBp);
    expect(row.outcome).toBe('issued');
  });
});

// ---------------------------------------------------------------------------
// T32u — the guard must withhold from migrated members and NOBODY ELSE.
// ---------------------------------------------------------------------------
describe('T32u a wallet top-up does not disqualify a brand-new member', () => {
  it('the member who tops up first still gets the voucher on their first drink', async () => {
    // 🔴 THE DEFECT. The eligibility guard read the member's RAW points
    // balance as evidence of a history the BFF cannot see. But the BFF grants
    // points itself: POST /v1/wallet/topup pays WALLET_RELOAD_BONUS (50 points
    // at 20 JOD) with no order behind it. A first-time member who topped up
    // before their first purchase therefore looked migrated, was written a
    // PERMANENT 'ineligible' row, and could never be issued the voucher —
    // silently, with no error raised. W4's home screen actively invites that
    // path ("Top up 20 JOD or more and get bonus points ☕"), and the damage is
    // not only the lost voucher: the withheld population becomes "the holdout
    // arm ∪ the members who topped up first", and the second set is neither
    // randomised nor recorded as such.
    const m = await enrolTreatment();

    const top = await app.inject({
      method: 'POST', url: '/v1/wallet/topup',
      payload: { amount: 20 },
      headers: auth(m.token, { 'idempotency-key': randomUUID() }),
    });
    expect(top.statusCode).toBe(201);
    expect(top.json().bonusPoints).toBeGreaterThan(0);
    expect((await backend.getMember(m.id)).points).toBeGreaterThan(0);

    const r = await checkout(m.token, DRINK.id);
    expect(r.statusCode).toBe(201);
    expect(
      r.json().secondVisitVoucher,
      'a balance the BFF granted itself is not evidence of an unseen history',
    ).not.toBeNull();
    expect((await backend.getSecondVisitVoucher(m.id))!.outcome).toBe('issued');
  });

  it('a balance the BFF cannot account for still refuses, on its own', () => {
    // The guard itself is unchanged in strength: what moved is WHICH number is
    // handed to it. All 47,720 live members arrive carrying a balance no entry
    // in this ledger explains — 47,720 × 0.399 JOD = 19,040 JOD of material.
    expect(decideSecondVisit(input({ unexplainedPoints: 1 }), RULES).row!.outcome)
      .toBe('ineligible');
    expect(decideSecondVisit(input({ unexplainedPoints: 0 }), RULES).row!.outcome)
      .toBe('issued');
  });

  it('the backend subtracts its own ledger, and only its own', async () => {
    // The subtraction is `balance − Σ(history deltas)`, and history is the
    // complete record of every points movement this process made (addPoints and
    // spendPoints are the only writers of Member.points, and both log). A
    // member the BFF granted 50 and then spent 30 of has 20 points and NOTHING
    // unexplained.
    const m = await enrolTreatment();
    await backend.addPoints(m.id, 50, 'ledger', 'ledger');
    await backend.spendPoints(m.id, 30, 'ledger', 'ledger');
    expect((await backend.getMember(m.id)).points).toBe(20);

    const r = await checkout(m.token, DRINK.id);
    expect(r.statusCode).toBe(201);
    expect((await backend.getSecondVisitVoucher(m.id))!.outcome).toBe('issued');
  });
});
