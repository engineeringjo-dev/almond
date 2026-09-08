import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { config } from '@almond/shared/config';
import {
  MAX_NAME_LENGTH, isProfileComplete, migratedProfileBonusAt, normalizeName, profileBonusFor,
} from '@almond/shared/loyalty/profile';
import { randomUUID } from 'node:crypto';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import { shiftDayKey } from '@almond/shared/loyalty/window';
import {
  consumeFifo, grantLot, liveBalance, walletLotRulesFromConfig,
} from '@almond/shared/loyalty/lots';
import { computeEarn, earnRulesFromConfig } from '@almond/shared/loyalty/earn';
import { menuItems } from '@almond/shared/menu';
import { build } from '../src/server';
import { signIn } from './lib/signIn';

/**
 * T33 — the profile, and the one-time bonus for filling it in.
 *
 * Owner, 2026-09-08: «٥٠ نقطة اذا بحط معلوماته وبصير الاسم مربوط باسم التعريف
 * فبتصير مثلا صباح الخير حمزة».
 *
 * A one-time grant driven by a client-supplied form is a mint if anything about
 * it is decided on the client, so these are OUTCOME tests against the real
 * route over HTTP: what a member's balance actually is after they save, and
 * after they save again. T1-T15, T24, T27, T29-T32 are taken; this file claims
 * T33.
 */

const BONUS = config.PROFILE_COMPLETION_BONUS;
const newPhone = (): string => `+9627${Math.floor(Math.random() * 90000000 + 10000000)}`;

/** Sign a brand-new member in and return their bearer token. A fresh phone each
 *  time, so no test inherits another's profile stamp. */
async function freshMember(app: FastifyInstance): Promise<string> {
  return signIn(app, newPhone());
}

const save = (app: FastifyInstance, token: string, body: Record<string, unknown>) =>
  app.inject({
    method: 'POST',
    url: '/v1/me/profile',
    headers: { authorization: `Bearer ${token}` },
    payload: body,
  });

const balance = async (app: FastifyInstance, token: string): Promise<number> => {
  const res = await app.inject({
    method: 'GET',
    url: '/v1/me/balance',
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.statusCode).toBe(200);
  return res.json().points as number;
};

describe('T33 the profile bonus', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await build(); await app.ready(); });
  afterAll(async () => { await app.close(); });

  it('T33a a new member starts with no name, so the greeting has nothing to use', async () => {
    // The precondition for everything else, and the fix that reached the app
    // the same day: findOrCreateByPhone used to invent `name: 'Member'`. An
    // invented name is not a name — it would also mean the member arrived with
    // a "complete" profile and could never earn the bonus for a real one.
    const token = await freshMember(app);
    const res = await save(app, token, { name: '', birthday: null });
    expect(res.statusCode).toBe(200);
    expect(res.json().profile.name).toBe('');
    expect(res.json().bonusGranted).toBe(0);
  });

  it('T33b saving a name pays the bonus exactly once', async () => {
    const token = await freshMember(app);
    const before = await balance(app, token);

    const first = await save(app, token, { name: 'حمزة', birthday: null });
    expect(first.statusCode).toBe(200);
    expect(first.json().bonusGranted).toBe(BONUS);
    expect(first.json().profile.name).toBe('حمزة');

    // 🔴 THE BALANCE, NOT THE REPLY. A route can report a grant it never made.
    expect(await balance(app, token)).toBe(before + BONUS);

    // Saving again is an ordinary thing to do — correcting a typo, adding a
    // birthday later. It must SUCCEED and pay NOTHING.
    const second = await save(app, token, { name: 'حمزة خ', birthday: '1990-04-20' });
    expect(second.statusCode).toBe(200);
    expect(second.json().bonusGranted).toBe(0);
    expect(second.json().profile.name).toBe('حمزة خ');
    expect(second.json().profile.birthday).toBe('1990-04-20');
    expect(await balance(app, token)).toBe(before + BONUS);
  });

  it('T33c clearing the name afterwards does not re-arm the bonus', async () => {
    // The mint this forbids: save a name (+50), clear it, save it again (+50),
    // forever. The stamp is a timestamp on the member and is never derived from
    // "does this member currently have a name".
    const token = await freshMember(app);
    expect((await save(app, token, { name: 'Hamza', birthday: null })).json().bonusGranted).toBe(BONUS);
    const paid = await balance(app, token);

    for (let i = 0; i < 5; i += 1) {
      expect((await save(app, token, { name: '', birthday: null })).json().bonusGranted).toBe(0);
      expect((await save(app, token, { name: 'Hamza', birthday: null })).json().bonusGranted).toBe(0);
    }
    expect(await balance(app, token)).toBe(paid);
  });

  it('T33d whitespace is not a name', async () => {
    const token = await freshMember(app);
    const res = await save(app, token, { name: '   \t  ', birthday: null });
    expect(res.json().bonusGranted).toBe(0);
    expect(res.json().profile.name).toBe('');
    // And the member is still eligible — they have not told us anything yet.
    expect((await save(app, token, { name: 'Hamza', birthday: null })).json().bonusGranted).toBe(BONUS);
  });

  it('T33e the route requires a member', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/me/profile', payload: { name: 'Hamza', birthday: null },
    });
    expect(res.statusCode).toBe(401);
  });

  it('T33f the client cannot ask to be paid', async () => {
    // The body carries a NAME. Extra fields claiming a grant are not read: the
    // reply is what the SERVER decided, and the balance proves it.
    const token = await freshMember(app);
    const res = await save(app, token, {
      name: 'Hamza', birthday: null,
      bonusGranted: 100000, points: 100000, profileBonusAt: null,
    });
    expect(res.json().bonusGranted).toBe(BONUS);
    expect(await balance(app, token)).toBe(BONUS);
  });

  it('T33g a pasted essay is bounded, not rejected', async () => {
    const token = await freshMember(app);
    const res = await save(app, token, { name: 'ا'.repeat(500), birthday: null });
    expect(res.statusCode).toBe(200);
    expect(res.json().profile.name.length).toBe(MAX_NAME_LENGTH);
    expect(res.json().bonusGranted).toBe(BONUS);
  });

  it('T33h an unparseable name is refused at the edge', async () => {
    const token = await freshMember(app);
    expect((await save(app, token, { name: 42 })).statusCode).toBe(400);
    // Genuine abuse is still refused at the edge — a name is a name.
    expect((await save(app, token, { name: 'a'.repeat(9000) })).statusCode).toBe(400);
    expect((await save(app, token, { name: 'x', birthday: '20/04/1990' })).statusCode).toBe(400);
  });
});

describe('T33 the shared predicate', () => {
  it('collapses and bounds a name the same way everywhere', () => {
    expect(normalizeName('  حمزة   خ  ')).toBe('حمزة خ');
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
    expect(normalizeName('a'.repeat(200)).length).toBe(MAX_NAME_LENGTH);
  });

  it('a birthday alone does not complete a profile', () => {
    // Deliberate: gating the bonus on a birthdate would let anyone unwilling to
    // hand one over refuse it, and the owner asked for the name.
    expect(isProfileComplete({ name: '', birthday: '1990-04-20' })).toBe(false);
    expect(isProfileComplete({ name: 'Hamza', birthday: null })).toBe(true);
  });

  it('the dial can switch the bonus off without breaking the save', () => {
    const p = { name: 'Hamza', birthday: null };
    expect(profileBonusFor(p, false, 0)).toBe(0);
    expect(profileBonusFor(p, false, -50)).toBe(0);
    expect(profileBonusFor(p, false, Number.NaN)).toBe(0);
    expect(profileBonusFor(p, false, 50)).toBe(50);
    expect(profileBonusFor(p, true, 50)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T34 — the wallet is a ledger: two-year money, spent oldest first.
// ---------------------------------------------------------------------------
/**
 * Owner, 2026-09-08: the wallet holds top-up balance and gift-card balance —
 * «نفس رصيد الشحن … صلاحية ٢ سنة first in first out» — and paying from it
 * earns «٥٠٪ رصيد نقاط اضافي».
 *
 * `walletFils: number` could not express any of that. These test the OUTCOME
 * through the real routes: what a member's balance is, what it earns, and what
 * happens to money older than the promise.
 */
describe('T34 the wallet ledger', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await build(); await app.ready(); });
  afterAll(async () => { await app.close(); });

  const topUp = (token: string, amount: number) =>
    app.inject({
      method: 'POST',
      url: '/v1/wallet/topup',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': randomUUID() },
      payload: { amount },
    });

  const wallet = async (token: string): Promise<number> => {
    const res = await app.inject({
      method: 'GET', url: '/v1/me/wallet', headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return res.json().balance as number;
  };

  it('T34a a top-up is money, and the balance is derived from the lots', async () => {
    const token = await signIn(app, newPhone());
    expect(await wallet(token)).toBe(0);
    const res = await topUp(token, 20);
    expect(res.statusCode).toBe(201);
    expect(res.json().walletBalance).toBe(20);
    expect(await wallet(token)).toBe(20);
  });

  it('T34b two top-ups are two lots, not one renewed balance', async () => {
    // 🔴 THE WHOLE REASON THE SCALAR HAD TO GO. If a second top-up renewed the
    // first, "first in first out" would be meaningless and the older money
    // would never die. The balance adds up; the lots stay separate.
    const token = await signIn(app, newPhone());
    await topUp(token, 10);
    await topUp(token, 15);
    expect(await wallet(token)).toBe(25);
  });

  it('T34c paying from the wallet earns 1.5× — the gift-card promise', async () => {
    // The owner sells gift cards on «٥٠٪ رصيد نقاط اضافي عند صرفها», and
    // gift-card balance and top-up balance are one thing, so the multiplier is
    // on the wallet as a whole. Asserted as an OUTCOME: the same basket, paid
    // two ways, must pay different points.
    const rules = { ...earnRulesFromConfig() };
    const cash = computeEarn({ total: 10, at: new Date() }, rules);
    const fromWallet = computeEarn({ total: 10, paidFromBalance: true, at: new Date() }, rules);
    expect(fromWallet.points).toBeGreaterThan(cash.points);
    expect(fromWallet.points).toBe(Math.round(cash.points * config.WALLET_EARN_MULTIPLIER));
  });

  it('T34d money does not expire — and the mechanism still works if it ever does', async () => {
    // 🔴 THIS TEST REVERSED THE SAME DAY IT WAS WRITTEN. It first asserted that
    // wallet money older than two years was gone. Shown that expiring balance a
    // customer PAID US is a regulated, complaint-generating mechanic, the owner
    // decided: «اذا النقود بدون صلاحية».
    //
    // Both halves are pinned. The first is what ships. The second keeps the
    // machinery honest and covered, so turning it back on is a dial and not a
    // rebuild.
    const today = ammanDayKey(new Date());
    const ancient = shiftDayKey(today, -(365 * 10));   // ten years ago

    // 1) AS SHIPPED: WALLET_LIFE_MONTHS is null, so the lot carries NO expiry
    //    day at all — not a distant one. A member's money is not given a
    //    fictional date it might one day reach.
    const shipped = walletLotRulesFromConfig();
    expect(config.WALLET_LIFE_MONTHS).toBeNull();
    const forever = grantLot([], 20_000, 'topup', undefined, shipped, ancient).lots;
    expect(forever[0].expiresOn).toBeNull();
    expect(liveBalance(forever)).toBe(20_000);

    // 2) WITH A LIFETIME SET: the same code expires the old lot and leaves the
    //    recent one alone. No sweep runs — a dead lot contributes 0 to every
    //    reader from the instant it dies.
    const mortal = { ...shipped, lifeMonths: 24 };
    let lots = grantLot([], 20_000, 'topup', undefined, mortal, ancient).lots;
    lots = grantLot(lots, 5_000, 'gift', undefined, mortal, shiftDayKey(today, -30)).lots;
    expect(liveBalance(lots)).toBe(5_000);

    // 3) AND THE EXEMPTION IS PER LOT, so re-enabling expiry cannot reach
    //    backwards into money already granted without one. That is the whole
    //    reason expiresOn is stored rather than derived.
    const mixed = grantLot(forever, 5_000, 'topup', undefined, mortal, ancient).lots;
    expect(liveBalance(mixed)).toBe(20_000);
  });

  it('T34e a spend takes the oldest money first', async () => {
    const RULES = walletLotRulesFromConfig();
    const today = ammanDayKey(new Date());
    let lots = grantLot([], 10_000, 'topup', undefined, RULES, shiftDayKey(today, -400)).lots;
    lots = grantLot(lots, 10_000, 'gift', undefined, RULES, today).lots;

    const res = consumeFifo(lots, 12_000, new Date());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // The 400-day-old lot is exhausted; the shortfall comes out of today's.
    const live = res.lots.filter((l) => l.remaining > 0);
    expect(live.length).toBe(1);
    expect(live[0].grantedOn).toBe(today);
    expect(live[0].remaining).toBe(8_000);
  });

  it('T34f a spend larger than the balance is refused, and writes nothing', async () => {
    // 🔴 THIS TEST WAS VACUOUS ON ITS FIRST WRITING. It posted `items: []` where
    // the route expects `lines`, so it was refused by the schema and never
    // reached the wallet at all — it asserted a 4xx that any malformed body
    // would produce. A real line, priced above the balance, is what exercises
    // the FIFO shortfall check.
    const token = await signIn(app, newPhone());
    await topUp(token, 1);                       // 1 JOD, less than any basket
    const before = await wallet(token);
    const item = menuItems.find((m) => m.sizes[0].price > 1)!;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/checkout',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': randomUUID() },
      payload: {
        branchId: 'b1', orderType: 'pickup', paymentMethod: 'wallet',
        lines: [{ itemId: item.id, sizeId: item.sizes[0].id, optionIds: [], qty: 1 }],
      },
    });

    // The named refusal, not merely "some 4xx" — consumeFifo checks the live
    // total BEFORE it debits anything, so the member is told no rather than
    // charged and then told no.
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('insufficient_wallet');
    expect(await wallet(token)).toBe(before);
  });
});

describe('T33m the Wafii migration must not pay for names it already carries', () => {
  // Owner, 2026-09-08: «لا نقود لاسم نملكه سلفاً».
  //
  // 🔴 THIS SUITE IS 23,860 JOD. The export carries a name for all 47,720
  // members; the bonus is 50 points at 100 points/JOD = 0.500 JOD each. An
  // import that leaves `profileBonusAt` null pays every one of them for a fact
  // we already hold — and nothing errors, because profileBonusFor is behaving
  // exactly as specified when it does. These tests are the only thing that
  // fails.
  const CUTOVER = '2026-10-01T00:00:00.000Z';
  const MEMBERS = 47_720;

  it('a migrated member who arrives with a name is settled at the cutover', () => {
    const stamp = migratedProfileBonusAt({ name: 'حمزة', birthday: null }, CUTOVER);
    expect(stamp).toBe(CUTOVER);
    // The stamp is only worth anything if it actually closes the payment, so
    // this asserts the OUTCOME through the same function the save handler uses,
    // not merely that a string came back.
    expect(profileBonusFor({ name: 'حمزة', birthday: null }, stamp !== null)).toBe(0);
  });

  it('the whole import costs nothing — the sum, not one row', () => {
    // One member proves the branch; the batch is what the money is. If a future
    // edit makes the stamp conditional on something the export lacks (a
    // birthday, a verified phone), this is where the bill reappears.
    const paid = Array.from({ length: 1000 }, (_, i) => {
      const profile = { name: `عضو ${i}`, birthday: null };
      return profileBonusFor(profile, migratedProfileBonusAt(profile, CUTOVER) !== null);
    }).reduce((a, b) => a + b, 0);
    expect(paid).toBe(0);

    // What it would have cost with the stamp left null, stated in dinars so the
    // number in the comment above is checked rather than asserted by prose.
    const perMember = config.PROFILE_COMPLETION_BONUS / config.POINTS_PER_JOD_REDEEM;
    expect(perMember).toBe(0.5);
    expect(perMember * MEMBERS).toBe(23_860);
  });

  it('a record WITHOUT a name is not settled — that bonus is still owed', () => {
    // The rule is "no money for a name we already own", not "no money". A row
    // the export could not give us a name for leaves the member eligible, so
    // they are paid the day they tell us themselves.
    for (const nameless of [{ name: '' }, { name: '   ' }, {}, null, undefined]) {
      expect(migratedProfileBonusAt(nameless, CUTOVER)).toBeNull();
    }
    const stamp = migratedProfileBonusAt({ name: '' }, CUTOVER);
    expect(profileBonusFor({ name: 'حمزة' }, stamp !== null))
      .toBe(config.PROFILE_COMPLETION_BONUS);
  });

  it('settled means settled — the app cannot pay a migrated member a second time', () => {
    // The second door. A migrated member opening the app and saving their
    // details re-enters the same handler; the stamp is what makes that save
    // free. Skipping payment at import WITHOUT stamping would only defer the
    // 23,860 JOD to the first time each member edits their name.
    const profile = { name: 'حمزة', birthday: '1990-04-20' };
    const stamp = migratedProfileBonusAt(profile, CUTOVER);
    expect(profileBonusFor({ ...profile, name: 'حمزة العموش' }, stamp !== null)).toBe(0);
  });

  it('the migration and the app agree on what "we have a name" means', () => {
    // One predicate, two callers. If the import used a looser test than the
    // save handler, a member could be stamped as settled while the app still
    // considers their profile incomplete — settled AND nagged, paid never.
    for (const p of [{ name: 'حمزة' }, { name: '  حمزة  ' }, { name: '' }, {}]) {
      expect(migratedProfileBonusAt(p, CUTOVER) !== null).toBe(isProfileComplete(p));
    }
  });
});
