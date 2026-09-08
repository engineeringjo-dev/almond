import { randomUUID } from 'node:crypto';
import { config as loyalty } from '@almond/shared/config';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import {
  decideSecondVisit, secondVisitStatus,
  type SecondVisitVoucher,
} from '@almond/shared/loyalty/secondVisit';
import {
  evaluate, evaluationPeriod, holdRung, pruneSpend, qualifiedRung, qualifyingSpend,
  qualifyingVisitDays, shiftDayKey, spendEntry, standing, windowRulesFromConfig,
  type Evaluation,
} from '@almond/shared/loyalty/window';
import type { TierId } from '@almond/shared/types';
import { conflict, notFound } from '../http-error';
import { toFils } from '../money';
import type { Backend, Member, HistoryEntry, NewOrder, OrderRecord, SubscriptionState } from './types';

/** One business day for the whole system (§3.6) — Amman, not the host's UTC.
 *  This is the §5 step 1 repoint. It moves the daily free-drink counter's reset
 *  from 03:00 Amman (the UTC rollover) to 00:00 Amman. That is the day
 *  BOUNDARY, not the cap: `drinksPerDay` is untouched, and the cap's VALUE is
 *  the product decision held in §8.5 (D7). */
const todayKey = (): string => ammanDayKey();

/** One window definition for the whole process, read once. */
const WINDOW = windowRulesFromConfig();

/** In-memory, runnable adapter. State lives in process memory (fine for dev /
 *  demo / tests); swap for the Odoo adapter in production. */
export function createMemoryBackend(): Backend {
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
  const demo: Member = {
    id: 'demo', phone: '+962790000000', name: 'Almond Member',
    points: 240, walletFils: toFils(20),
    spend: [
      { jod: 95.0, day: shiftDayKey(todayKey(), -200) },
      { jod: 22.5, day: shiftDayKey(todayKey(), -61) },
      { jod: 18.0, day: shiftDayKey(todayKey(), -40) },
      { jod: 14.5, day: shiftDayKey(todayKey(), -18) },
      { jod: 15.0, day: shiftDayKey(todayKey(), -3) },
    ],
    heldTierId: 'top',
    evaluatedThrough: evaluationPeriod(todayKey(), WINDOW.evaluation),
    lastEarnAt: Date.now(),
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
        id: `m_${randomUUID()}`, phone, name: name ?? 'Member',
        points: 0, walletFils: 0,
        // No history, so: 0 JOD, 0 visit days, the entry rung, and the current
        // period already closed (nothing happened in it to requalify for).
        spend: [], heldTierId: 'base',
        evaluatedThrough: evaluationPeriod(todayKey(), WINDOW.evaluation),
        lastEarnAt: Date.now(),
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
      if (m.walletFils < fils) throw conflict('insufficient_wallet', 'Wallet balance is not enough');
      m.walletFils -= fils;
      return m.walletFils;
    },
    async creditWallet(id, fils) { const m = must(id); m.walletFils += fils; return m.walletFils; },
    async addPoints(id, delta, reasonAr, reasonEn) {
      const m = must(id); m.points += delta;
      log(id, { deltaPoints: delta, reasonAr, reasonEn, createdAt: new Date().toISOString() });
      return m.points;
    },
    async spendPoints(id, points, reasonAr, reasonEn) {
      const m = must(id);
      if (m.points < points) throw conflict('insufficient_points', 'Not enough points');
      m.points -= points;
      log(id, { deltaPoints: -points, reasonAr, reasonEn, createdAt: new Date().toISOString() });
      return m.points;
    },
    async recordSpend(id, jod, occurredOn) {
      const m = must(id);
      const at = new Date();
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
      m.lastEarnAt = Date.now();
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
        // spendPoints are the only writers of m.points and both log), so the
        // remainder is exactly the balance that arrived from somewhere else.
        // Without the subtraction, POST /v1/wallet/topup — which grants 50
        // points at 20 JOD with no order behind it — made a brand-new member
        // look migrated and cost them the voucher permanently (T32u).
        unexplainedPoints:
          m.points - (history.get(input.memberId) ?? []).reduce((s, h) => s + h.deltaPoints, 0),
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
