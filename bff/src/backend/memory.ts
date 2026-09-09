import { randomUUID } from 'node:crypto';
import { config as loyalty } from '@almond/shared/config';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import {
  consumeFifo, expiredBetween, grantLot, liveBalance, lotRulesFromConfig, migrateBalance,
  pruneLots, walletLotRulesFromConfig,
} from '@almond/shared/loyalty/lots';
import { normalizeName, profileBonusFor } from '@almond/shared/loyalty/profile';
import {
  decideSecondVisit, secondVisitStatus,
  type SecondVisitVoucher,
} from '@almond/shared/loyalty/secondVisit';
import {
  evaluate, evaluationPeriod, holdRung, pruneSpend, qualifiedRung, qualifyingSpend,
  qualifyingVisitDays, shiftDayKey, spendEntry, standing, windowRulesFromConfig,
  type Evaluation,
} from '@almond/shared/loyalty/window';
import {
  buildRosterIndex, entitlementFor,
  type CompanyDiscount, type CorporateMemberEntry,
} from '@almond/shared/loyalty/corporate';
import type { TierId } from '@almond/shared/types';
import { conflict, notFound } from '../http-error';
import { toFils } from '../money';
import type {
  Backend, Member, HistoryEntry, NewOrder, OrderRecord, SubscriptionState, CorporateUse,
} from './types';

/** One business day for the whole system (§3.6) — Amman, not the host's UTC.
 *  This is the §5 step 1 repoint. It moves the daily free-drink counter's reset
 *  from 03:00 Amman (the UTC rollover) to 00:00 Amman. That is the day
 *  BOUNDARY, not the cap: `drinksPerDay` is untouched, and the cap's VALUE is
 *  the product decision held in §8.5 (D7). */
const todayKey = (): string => ammanDayKey();

/** One window definition for the whole process, read once. */
const WINDOW = windowRulesFromConfig();
/** One lot-life definition for the whole process, read once — the mirror of
 *  WINDOW. Every grant stores the expiry day these rules gave it, so editing
 *  the config later cannot reach back and move a promise already made. */
const LOTS = lotRulesFromConfig();
/** The money ledger's dials — 24 months, not the points' 12. */
const WALLET_LOTS = walletLotRulesFromConfig();

/** In-memory, runnable adapter. State lives in process memory (fine for dev /
 *  demo / tests); swap for the Odoo adapter in production. */
export function createMemoryBackend(): Backend {
  // ---- Corporate discount register ----
  // Seeded EMPTY on purpose: a standing discount is an arrangement somebody
  // signed, and inventing a demo one would mean a 50% row nobody remembers
  // agreeing to. The back-office uploads the real thing.
  const companies: CompanyDiscount[] = [];
  const roster = new Map<string, CorporateMemberEntry>();
  const corporateUses: CorporateUse[] = [];

  const members = new Map<string, Member>();
  const byPhone = new Map<string, string>();
  const history = new Map<string, HistoryEntry[]>();
  const orders: OrderRecord[] = [];
  /** ONE ROW PER MEMBER, EVER — the key IS the "once per member" constraint,
   *  which is why the storage model and config.SECOND_VISIT_VOUCHER
   *  .oncePerMember must not drift apart (T32n pins the flag). The Odoo form is
   *  UNIQUE(partner_id) on almond_loyalty_second_visit. */
  const vouchers = new Map<string, SecondVisitVoucher>();

  // Seed a demo member so a freshly-issued token has data.
  //
  // A REAL LOG, not the frozen `windowSpend: 120` this replaced. 70 JOD across
  // four distinct in-window days puts the demo member on the 6% rung through
  // BOTH doors at once (70 >= 65 JOD, and 4 >= TIER2_VISITS_ALTERNATIVE), which
  // is what keeps bff/test/earn.test.ts T10 — which recomputes the grant from
  // `before.windowSpend` with no held rung — meaningful rather than accidental.
  //
  // The 95 JOD entry 200 days back is the point of the whole package: it is
  // OUTSIDE the window and does not count. It survives until the demo member's
  // first write, which prunes it — pruning is lossless for the rate.
  //
  // 🔴 THE 240 POINTS ARE TWO MIGRATION LOTS, NOT ONE SCALAR. The total is kept
  // at exactly 240 (bff/test/secondVisit.test.ts T32d and bff/test/copy.test.ts
  // both rest on it) but it is split across two dates so the demo member shows
  // real FIFO order and a non-null `nextExpiry` with no test fixture at all:
  // 200 points a month from death, 40 fresh today. THE BACK-DATING IS A DEMO OF
  // A MATURE MEMBER — the real migration dates EVERY lot at the cutover day
  // (see migrationLot's docstring: a rule may not take money retroactively).
  // Nobody should copy the -335 into a migration script.
  //
  // `source: 'migration'` and NO history rows, exactly like a real migrated
  // member: that is what keeps `unexplainedPoints` equal to 240 and the
  // second-visit voucher's 19,040 JOD guard armed for this fixture.
  const demo: Member = {
    id: 'demo', phone: '+962790000000', name: 'Almond Member',
    birthday: null,
    // The demo member already has a name, so the bonus is settled for them —
    // otherwise the fixture would hand out 50 points the first time anyone
    // opened the profile screen against it.
    profileBonusAt: new Date().toISOString(),
    lots: grantLot(
      migrateBalance(200, shiftDayKey(todayKey(), -335), LOTS),
      40, 'migration', undefined, LOTS, todayKey(),
    ).lots,
    expirySettledThrough: todayKey(),
    // 20 JOD topped up today: one lot, its own two-year clock.
    walletLots: grantLot([], toFils(20), 'topup', undefined, WALLET_LOTS, todayKey()).lots,
    walletExpirySettledThrough: todayKey(),
    spend: [
      { jod: 95.0, day: shiftDayKey(todayKey(), -200) },
      { jod: 22.5, day: shiftDayKey(todayKey(), -61) },
      { jod: 18.0, day: shiftDayKey(todayKey(), -40) },
      { jod: 14.5, day: shiftDayKey(todayKey(), -18) },
      { jod: 15.0, day: shiftDayKey(todayKey(), -3) },
    ],
    heldTierId: 'top',
    evaluatedThrough: evaluationPeriod(todayKey(), WINDOW.evaluation),
    subRenewsAt: 0, subDay: '', subDayCount: 0,
  };
  members.set(demo.id, demo);
  byPhone.set(demo.phone, demo.id);
  history.set(demo.id, []);

  const must = (id: string): Member => {
    const m = members.get(id);
    if (!m) throw notFound('member not found');
    return m;
  };
  const log = (id: string, e: HistoryEntry) => {
    const h = history.get(id) ?? [];
    h.unshift(e);
    history.set(id, h);
  };

  /**
   * Book any points that have DIED since this member was last settled, then
   * drop the rows nothing needs any more.
   *
   * 🔴 THIS IS NOT WHAT MAKES THE BALANCE FALL. `liveBalance` already reads 0
   * for a dead lot, for every caller, from the instant it dies — there is no
   * "in the meantime" and no scheduler is needed. What this writes is the LEDGER
   * LINE: points vanishing with no row in the member's history is exactly the
   * support ticket per-lot expiry would otherwise create, and it is also the
   * breakage record an IFRS 15 vintage schedule reads.
   *
   * It also keeps `unexplainedPoints` exact. That guard is
   * `liveBalance − Σ(history deltas)`; without the expiry row it would drift
   * NEGATIVE for any member whose lots died. Harmless to the guard itself
   * (which tests `> 0`) but wrong, and wrong in the one number the 19,040 JOD
   * over-issue guard is computed from.
   *
   * Idempotent by the stamp, and a dead lot's `remaining` never moves again, so
   * nothing can be booked twice. Runs FIRST on every write path — including
   * evaluateSecondVisitVoucher, which the checkout saga calls at step 4 BEFORE
   * addPoints/recordSpend, so that reader never sees an unsettled member. It is
   * still strictly pre-transaction, so checkout.ts's ordering invariant and
   * T32a are preserved.
   */
  const settleExpiry = (m: Member, at: Date): void => {
    const today = ammanDayKey(at);
    const lost = expiredBetween(m.lots, m.expirySettledThrough, today);
    if (lost > 0) {
      log(m.id, {
        deltaPoints: -lost,
        reasonAr: 'انتهاء صلاحية نقاط',
        reasonEn: 'Points expired',
        createdAt: at.toISOString(),
      });
    }
    m.expirySettledThrough = today;
    // Only AFTER the loss is booked: pruning first would take the rows the
    // history row is derived from with it.
    m.lots = pruneLots(m.lots, at, LOTS);
  };

  /**
   * Book any MONEY that died since the last settlement, then prune.
   *
   * Deliberately separate from settleExpiry rather than folded into it: the two
   * ledgers have different lifetimes and different history wording, and a
   * member losing prepaid cash deserves its own line — «انتهاء صلاحية رصيد»,
   * not "points expired". The history's `deltaPoints` is a points column, so
   * the loss is recorded at 0 and named in the reason: the wallet's own
   * arithmetic lives in its lots, and writing fils into a points ledger would
   * corrupt `unexplainedPoints`.
   */
  const settleWalletExpiry = (m: Member, at: Date): void => {
    const today = ammanDayKey(at);
    const lostFils = expiredBetween(m.walletLots, m.walletExpirySettledThrough, today);
    if (lostFils > 0) {
      const lostJod = (lostFils / 1000).toFixed(3);
      log(m.id, {
        deltaPoints: 0,
        reasonAr: `انتهاء صلاحية رصيد (${lostJod} د.أ)`,
        reasonEn: `Wallet balance expired (${lostJod} JOD)`,
        createdAt: at.toISOString(),
      });
    }
    m.walletExpirySettledThrough = today;
    m.walletLots = pruneLots(m.walletLots, at, WALLET_LOTS);
  };

  /** Close any evaluation period that has come due, and stamp how far we got.
   *  There is no cron in the BFF, so the write path is the only trigger; that
   *  is provably nil for the RATE (the floor only ever rises, and the rate is
   *  max(floor, live window) on every read) and costs only the coupon stamp for
   *  a quarter in which the member never transacted. */
  const runDueEvaluation = (m: Member, at: Date): Evaluation[] => {
    const due = evaluate(m.spend, m.heldTierId, m.evaluatedThrough, WINDOW, at);
    for (const e of due) {
      m.heldTierId = holdRung(m.heldTierId, qualifiedRung(e.windowSpend, e.visitDays, WINDOW), WINDOW).id as TierId;
      m.evaluatedThrough = e.period;
    }
    return due;
  };

  return {
    async findOrCreateByPhone(phone, name) {
      const existing = byPhone.get(phone);
      if (existing) return members.get(existing)!;
      const m: Member = {
        // normalizeName, never `name ?? 'Member'`. That fallback invented a
        // display name in ONE language, which is the defect the app side has
        // just been cleared of: a name is a fact about a person, so it is
        // either theirs or empty. Empty is what makes them eligible for the
        // profile bonus, which is correct — they have told us nothing yet.
        id: `m_${randomUUID()}`, phone, name: normalizeName(name),
        birthday: null,
        profileBonusAt: null,
        // A genuinely NEW member gets an empty ledger — never a migration lot.
        // Minting one would make every new member look migrated to
        // `unexplainedPoints` and cost them the second-visit voucher (T32u's
        // defect, in the other direction).
        lots: [], expirySettledThrough: todayKey(),
        walletLots: [],
        walletExpirySettledThrough: todayKey(),
        // No history, so: 0 JOD, 0 visit days, the entry rung, and the current
        // period already closed (nothing happened in it to requalify for).
        spend: [], heldTierId: 'base',
        evaluatedThrough: evaluationPeriod(todayKey(), WINDOW.evaluation),
        subRenewsAt: 0, subDay: '', subDayCount: 0,
      };
      members.set(m.id, m);
      byPhone.set(phone, m.id);
      history.set(m.id, []);
      return m;
    },
    async getMember(id) { return must(id); },
    async debitWallet(id, fils) {
      const m = must(id);
      const at = new Date();
      settleWalletExpiry(m, at);
      // OLDEST LOT FIRST, and the shortfall is found BEFORE any debit —
      // consumeFifo checks the live total first and returns a refusal that has
      // written nothing. A lot consumed in part keeps its own expiry day, so
      // the remainder still dies when it was always going to.
      const res = consumeFifo(m.walletLots, fils, at);
      if (!res.ok) throw conflict('insufficient_wallet', 'Wallet balance is not enough');
      m.walletLots = res.lots;
      return liveBalance(m.walletLots, at);
    },
    async creditWallet(id, fils, source) {
      const m = must(id);
      const at = new Date();
      settleWalletExpiry(m, at);
      // ONE LOT, ONE CLOCK. A top-up never renews money already held — the same
      // rule as points, and it is what makes "first in, first out" meaningful.
      m.walletLots = grantLot(m.walletLots, fils, source, at, WALLET_LOTS).lots;
      return liveBalance(m.walletLots, at);
    },
    async addPoints(id, delta, reasonAr, reasonEn) {
      const m = must(id);
      const at = new Date();
      settleExpiry(m, at);
      // ONE LOT, ONE CLOCK. The grant does not touch any existing lot, which is
      // «ولا تتجدد بشراء جديد» — a new purchase renews nothing. `delta === 0`
      // (a small invoice) writes no lot but still logs, so `history` stays the
      // complete ledger `unexplainedPoints` subtracts.
      m.lots = grantLot(m.lots, delta, 'earn', at, LOTS).lots;
      log(id, { deltaPoints: delta, reasonAr, reasonEn, createdAt: at.toISOString() });
      return liveBalance(m.lots, at);
    },
    async spendPoints(id, points, reasonAr, reasonEn) {
      const m = must(id);
      const at = new Date();
      settleExpiry(m, at);
      // 🔴 OLDEST LOT FIRST, AND THE SHORTFALL IS FOUND BEFORE ANY DEBIT.
      // consumeFifo checks the live total first and returns a refusal that has
      // written nothing — the alternative (debit, then discover it is short)
      // charges the member for a reward they did not get. The error code and
      // message are unchanged; only what they are measured against is.
      const res = consumeFifo(m.lots, points, at);
      if (!res.ok) throw conflict('insufficient_points', 'Not enough points');
      m.lots = res.lots;
      log(id, { deltaPoints: -points, reasonAr, reasonEn, createdAt: at.toISOString() });
      return liveBalance(m.lots, at);
    },
    async setProfile(id, profile) {
      const m = must(id);
      const name = normalizeName(profile.name);
      // The stamp is read BEFORE anything is written, and it is the backend's
      // own — a client cannot assert it. profileBonusFor returns 0 when it is
      // set, so re-saving a name succeeds and pays nothing.
      const bonus = profileBonusFor({ name, birthday: profile.birthday }, m.profileBonusAt !== null);
      m.name = name;
      m.birthday = profile.birthday;

      let pointsBalance = liveBalance(m.lots, new Date());
      if (bonus > 0) {
        // Stamp FIRST. If the grant threw between the two, an unstamped member
        // could be paid twice on retry; an over-stamped one is merely unpaid,
        // and that is the failure a human can see and fix. Fail closed.
        m.profileBonusAt = new Date().toISOString();
        pointsBalance = await this.addPoints(id, bonus, 'إكمال الملف الشخصي', 'Profile completed');
      }
      return { profile: { name, birthday: m.birthday }, bonusGranted: bonus, pointsBalance };
    },
    async recordSpend(id, jod, occurredOn) {
      const m = must(id);
      const at = new Date();
      settleExpiry(m, at);
      // Close any due period FIRST, so this quarter's requalification is judged
      // on the window as it stood before this transaction.
      runDueEvaluation(m, at);
      // A day the CALLER decided (a till reporting late), or today in Amman —
      // never the host's date. An `occurredOn` in the future is a clock fault:
      // it is recorded as evidence but the window will not count it (a fast
      // till must not hand out a head start), and it is not discarded here
      // because silently dropping a sale is worse than not counting it.
      m.spend.push(occurredOn ? { jod, day: occurredOn } : spendEntry(jod, at));
      // Bounded, not unbounded: the array can only ever hold the window. The
      // scalar it replaced could only ever grow — that WAS the defect.
      m.spend = pruneSpend(m.spend, WINDOW, at);
      // 🔴 The ONLY assignment of heldTierId on the write path, and it names
      // holdRung so W1-2's source walk can see it. holdRung cannot go down.
      m.heldTierId = holdRung(
        m.heldTierId,
        qualifiedRung(qualifyingSpend(m.spend, WINDOW, at), qualifyingVisitDays(m.spend, WINDOW, at), WINDOW),
        WINDOW,
      ).id as TierId;
    },
    async getStanding(id) { const m = must(id); return standing(m.spend, m.heldTierId, WINDOW); },
    async evaluateTier(id, at) { return runDueEvaluation(must(id), at ?? new Date()); },
    async createOrder(o: NewOrder) {
      const rec: OrderRecord = { ...o, id: `ord_${randomUUID()}`, createdAt: new Date().toISOString() };
      orders.push(rec);
      return rec;
    },
    async recordEarnBreakdown(orderId, breakdown) {
      const rec = orders.find((o) => o.id === orderId);
      if (!rec) throw notFound('order not found');
      // The whole breakdown, not just the points: §5b reconstructs the grant
      // and the shadow delta from this record. `pointsEarned` on the order is
      // set from the same number the moment it is known.
      rec.earn = breakdown;
      rec.pointsEarned = breakdown.points;
    },
    async getHistory(id) { must(id); return history.get(id) ?? []; },

    async evaluateSecondVisitVoucher(input) {
      const m = must(input.memberId);
      // Settle first, so `unexplainedPoints` below is computed on a member whose
      // expiry history is caught up. Still strictly PRE-transaction — no grant
      // and no spend row has been written — so T32a's ordering invariant and
      // checkout.ts's saga hold unchanged.
      settleExpiry(m, input.at);
      const decision = decideSecondVisit({
        memberId: input.memberId,
        orderId: input.orderId,
        voucherId: `svv_${randomUUID()}`,
        basketHasDrink: input.basketHasDrink,
        arm: input.arm,
        // The authoritative guard: a row, of ANY outcome, means this member has
        // already been evaluated and never will be again.
        alreadyEvaluated: vouchers.has(input.memberId),
        // The DURABLE marker. `orders` is never pruned, so it still answers
        // "has this member transacted before?" for a sale 100 days old —
        // Member.spend cannot, because W1 prunes it to the 90-day window and
        // its own docstring says it is not a lifetime history.
        //
        // Excluded BY ID rather than by subtracting one, so the count is
        // independent of where in the checkout saga this call lands.
        priorTransactions: orders.filter(
          (o) => o.memberId === input.memberId && o.id !== input.orderId,
        ).length,
        // 🔴 Read here, inside the backend, and therefore genuinely
        // PRE-transaction: addPoints and recordSpend have not run yet (the
        // route calls this at saga step 4). A member holding a balance the BFF
        // never granted has a history the BFF cannot see — all 47,720 live
        // members are in exactly that position, which is the 19,040 JOD
        // over-issue this guard exists to prevent.
        //
        // 🔴 MINUS WHAT THE BFF ITSELF GRANTED. `history` is the complete
        // ledger of every points movement this process made (addPoints and
        // spendPoints are the only writers of m.lots that log, so the
        // remainder is exactly the balance that arrived from somewhere else.
        // Without the subtraction, POST /v1/wallet/topup — which grants 50
        // points at 20 JOD with no order behind it — made a brand-new member
        // look migrated and cost them the voucher permanently (T32u).
        //
        // 🔴 THE LIVE BALANCE, NOT A STORED SCALAR. A migration lot carries no
        // history row on purpose (loyalty/lots.ts migrationLot), so for all
        // 47,720 migrated members this remainder is still their whole balance
        // and this guard still refuses. Logging the migration grant would make
        // every one of them "explained" and re-open the over-issue silently.
        unexplainedPoints:
          liveBalance(m.lots, input.at)
          - (history.get(input.memberId) ?? []).reduce((s, h) => s + h.deltaPoints, 0),
        priorWindowSpend: qualifyingSpend(m.spend, WINDOW, input.at),
        at: input.at,
      });
      if (decision.row) vouchers.set(input.memberId, decision.row);
      // Only an ISSUED row is visible to the caller. Copy, never the stored
      // object: handing out a mutable reference to `redeemedAt` would be
      // handing out the double-spend guard itself.
      const row = decision.row;
      return row && row.outcome === 'issued' ? { ...row } : null;
    },
    async getSecondVisitVoucher(memberId) {
      must(memberId);
      const v = vouchers.get(memberId);
      return v ? { ...v } : null;
    },
    async redeemSecondVisitVoucher(memberId, at) {
      must(memberId);
      // 🔴 THERE IS NO `await` BETWEEN THE CHECK OF redeemedAt AND THE WRITE
      // OF IT, and that is the entire double-spend guard. Node runs an async
      // body synchronously up to its first await, so with none here two
      // concurrent calls cannot interleave and exactly one can move null → ISO.
      // Same shape as spendPoints above.
      //
      // MEASURED, because the size of this is easy to get wrong: eight
      // redemptions dispatched in one synchronous burst against an `await
      // Promise.resolve()` inserted between the check and the write hand over
      // EIGHT pastries — all eight suspend having seen null, then all eight
      // write. (An await placed one line EARLIER, between the notFound check
      // and the redeemedAt check, happens to stay safe, because the resumed
      // calls still run their own check-and-write with nothing to yield to. The
      // rule to remember is therefore about this exact pair of lines, not about
      // the method in general.) T32h asserts the outcome.
      //
      // Idempotency-Key is NOT this guard: idempotency.ts keys on
      // memberId:METHOD:url:key, so a client retrying with a NEW key bypasses
      // it entirely.
      const v = vouchers.get(memberId);
      // One identical answer for absent / suppressed / declined / ineligible. A
      // distinct 'voucher_suppressed' code would tell a curious member they are
      // in the control arm, and a control arm that knows it is one is not one.
      if (!v || v.outcome !== 'issued') throw notFound('voucher not found');
      if (v.redeemedAt) throw conflict('voucher_already_redeemed', 'This voucher has already been used');
      if (secondVisitStatus(v, at) === 'expired') {
        throw conflict('voucher_expired', 'This voucher has expired');
      }
      v.redeemedAt = at.toISOString();
      return { ...v };
    },

    async activateSubscription(id) {
      const m = must(id);
      m.subRenewsAt = Date.now() + loyalty.SUBSCRIPTION.periodDays * 86400000;
      return subState(m);
    },
    async redeemSubscriptionDrink(id) {
      const m = must(id);
      if (m.subRenewsAt <= Date.now()) throw conflict('not_subscribed', 'No active subscription');
      const today = todayKey();
      if (m.subDay !== today) { m.subDay = today; m.subDayCount = 0; }
      if (m.subDayCount >= loyalty.SUBSCRIPTION.drinksPerDay) {
        throw conflict('daily_cap', 'Daily free-drink limit reached');
      }
      m.subDayCount += 1;
      return subState(m);
    },
    async getSubscription(id) { return subState(must(id)); },

    // ---- Corporate discounts ----
    async listCompanies() { return companies.map((c) => ({ ...c })); },

    async saveCompany(c) {
      const i = companies.findIndex((x) => x.id === c.id);
      if (i >= 0) companies[i] = { ...c }; else companies.push({ ...c });
      return { ...c };
    },

    async replaceRoster(companyId, entries) {
      // REPLACE. Every phone currently pointing at this company is dropped
      // first, so a member who left the company stops being entitled the moment
      // HR uploads the new list — a merge would leave leavers on 50% forever.
      for (const [phone, e] of roster) if (e.companyId === companyId) roster.delete(phone);
      for (const e of buildRosterIndex(entries).values()) roster.set(e.phone, e);
      return [...roster.values()].filter((e) => e.companyId === companyId).length;
    },

    async listRoster(companyId) {
      const all = [...roster.values()].map((e) => ({ ...e }));
      return companyId ? all.filter((e) => e.companyId === companyId) : all;
    },

    async entitlementFor(memberId) {
      // From the member's STORED phone — the one OTP proved — never from input.
      const m = members.get(memberId);
      return m ? entitlementFor(m.phone, companies, roster) : null;
    },

    async recordCorporateUse(use) {
      const row = { ...use, id: `cuse_${randomUUID()}` };
      corporateUses.unshift(row);
      return { ...row };
    },

    async listCorporateUses(filter) {
      return corporateUses
        .filter((u) => !filter?.companyId || u.companyId === filter.companyId)
        .filter((u) => !filter?.memberId || u.memberId === filter.memberId)
        .filter((u) => !filter?.from || u.at >= filter.from)
        .filter((u) => !filter?.to || u.at <= filter.to)
        .map((u) => ({ ...u }));
    },
  };

  function subState(m: Member): SubscriptionState {
    const active = m.subRenewsAt > Date.now();
    const redeemedToday = active && m.subDay === todayKey() ? m.subDayCount : 0;
    return {
      active,
      renewsAt: active ? new Date(m.subRenewsAt).toISOString() : null,
      drinksPerDay: loyalty.SUBSCRIPTION.drinksPerDay,
      redeemedToday,
      remainingToday: Math.max(0, loyalty.SUBSCRIPTION.drinksPerDay - redeemedToday),
    };
  }
}
