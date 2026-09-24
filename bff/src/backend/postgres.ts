import { randomInt, randomUUID } from 'node:crypto';
import { config as loyalty } from '@almond/shared/config';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import {
  consumeFifo, expiredBetween, grantLot, liveBalance, lotRulesFromConfig,
  pruneLots, restoreSlices, spentSlices, walletLotRulesFromConfig, type SpentSlice,
} from '@almond/shared/loyalty/lots';
import { jodFromPoints } from '@almond/shared/loyalty/earn';
import { normalizeName, profileBonusFor } from '@almond/shared/loyalty/profile';
import {
  decideSecondVisit, secondVisitStatus, type SecondVisitVoucher,
} from '@almond/shared/loyalty/secondVisit';
import {
  evaluate, evaluationPeriod, holdRung, pruneSpend, qualifiedRung, qualifyingSpend,
  qualifyingVisitDays, spendEntry, standing, windowRulesFromConfig, type Evaluation,
} from '@almond/shared/loyalty/window';
import {
  buildRosterIndex, entitlementFor as resolveEntitlement,
  type CompanyDiscount, type CorporateMemberEntry,
} from '@almond/shared/loyalty/corporate';
import {
  isRedeemable, normalizeRedemptionCode, redemptionExpiresAt, shouldRefund,
  REDEMPTION_ALPHABET, REDEMPTION_CODE_LENGTH, type RedemptionRow,
} from '@almond/shared/loyalty/redemption';
import type { TierId } from '@almond/shared/types';
import { conflict, notFound } from '../http-error';
import type { Db } from './db';
import type { HoldoutStamp } from '@almond/shared/loyalty/holdout';
import type {
  Backend, Member, HistoryEntry, NewOrder, OrderRecord, CorporateUse,
  PaymentIntent, TillRefund, TillSale, TillSpend,
} from './types';
import type { EarnBreakdown } from '@almond/shared/loyalty/earn';
import { IDEMPOTENCY_SWEEP_EVERY_MS, IDEMPOTENCY_TTL_MS } from './idempotency';
import {
  assertSameRefund, assertSameSale, assertSameSpend, earnTicketUsed, planOrRefuse, posOrderConflict,
  posSpendConflict, refundConflict, refundable, refundReasons, saleAlreadyReversed, spendTicketExpired,
  spendTicketUsed, syntheticFullRefund, ticketRefusalError,
} from '../pos/sales';
import { applyTillRefund } from '@almond/shared/loyalty';
import { assertIntentSpendable, nextIntentStatus } from '../payments/intent';
import { toFils, toJod } from '../money';

/**
 * THE DURABLE BACKEND. Same behaviour as the in-memory one, on Postgres.
 *
 * 🔴 WHY THE LEDGER ARITHMETIC IS NOT IN SQL. Points live in lots: one per
 * grant, each with its own twelve-month clock, spent oldest-first, never
 * renewed. That rule is already written, pure and tested in
 * @almond/shared/loyalty/lots.ts. Expressing it a second time in SQL would give
 * this repository two implementations of one rule — and it has paid for that
 * shape repeatedly: an app that computed points beside the server, a mock that
 * invented a voucher rail the server did not have, an `isDrink` flag that
 * disagreed with the classifier. So the arithmetic stays in TypeScript, the
 * member's lots are one jsonb column, and every mutation is a read-modify-write
 * inside a transaction that took `FOR UPDATE` on the row.
 *
 * 🔴 AND WHY THERE ARE STILL TWO IMPLEMENTATIONS. The in-memory backend is not
 * dead code — it is what `npm run dev` and 363 tests run against, with no
 * database to start. What stops the two drifting is bff/test/backend-contract:
 * one suite of assertions, executed against BOTH. A behaviour that exists in
 * one and not the other fails there.
 *
 * The seed differs deliberately: memory seeds a demo member so a fresh token
 * has data. A database is seeded by migration and by real use, so this does not
 * invent anyone.
 */

const LOTS = lotRulesFromConfig();
const WALLET_LOTS = walletLotRulesFromConfig();
const WINDOW = windowRulesFromConfig();
const todayKey = () => ammanDayKey(new Date());

/** Postgres returns `numeric` as a string to protect precision; every read of
 *  one goes through here so a JOD figure never reaches arithmetic as text. */
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0));
const iso = (v: unknown): string | null =>
  v == null ? null : (v instanceof Date ? v.toISOString() : String(v));

interface MemberRow {
  id: string; phone: string; name: string; birthday: string | null;
  profile_bonus_at: Date | string | null;
  lots: unknown; expiry_settled_through: string;
  wallet_lots: unknown; wallet_expiry_settled_through: string;
  spend: unknown; held_tier_id: string; evaluated_through: string;
}

function toMember(r: MemberRow): Member {
  return {
    id: r.id, phone: r.phone, name: r.name, birthday: r.birthday,
    profileBonusAt: iso(r.profile_bonus_at),
    lots: (r.lots ?? []) as Member['lots'],
    expirySettledThrough: r.expiry_settled_through,
    walletLots: (r.wallet_lots ?? []) as Member['walletLots'],
    walletExpirySettledThrough: r.wallet_expiry_settled_through,
    spend: (r.spend ?? []) as Member['spend'],
    heldTierId: r.held_tier_id as TierId,
    evaluatedThrough: r.evaluated_through,
  };
}

/** A pos_sales row → TillSale. `paid_total` is numeric (a string from pg);
 *  it is held in fils everywhere else so a comparison is exact. */
function toTillSale(row: Record<string, unknown>): TillSale {
  const intOrNull = (v: unknown) => (v == null ? null : Number(v));
  return {
    posOrderRef: row.pos_order_ref as string,
    memberId: row.member_id as string,
    branchId: row.branch_id as string,
    paidFils: toFils(num(row.paid_total)),
    paidAt: iso(row.paid_at)!,
    spendDay: (row.spend_day ?? null) as string | null,
    pointsEarned: Number(row.points_earned),
    pointsBalanceAfter: Number(row.points_balance_after),
    earn: (row.earn_breakdown ?? null) as EarnBreakdown | null,
    status: row.status as TillSale['status'],
    refundedFils: toFils(num(row.refunded_total)),
    reversedPoints: intOrNull(row.reversed_points),
    shortfall: intOrNull(row.shortfall),
    reverseBalanceAfter: intOrNull(row.reverse_balance_after),
    reverseReason: (row.reverse_reason ?? null) as string | null,
    reversedAt: iso(row.reversed_at),
    createdAt: iso(row.created_at)!,
  };
}

/** A pos_sale_refunds row → TillRefund. `refunded_total` is numeric (a string). */
function toTillRefund(row: Record<string, unknown>): TillRefund {
  return {
    refundRef: (row.refund_ref ?? null) as string | null,
    posOrderRef: row.pos_order_ref as string,
    memberId: row.member_id as string,
    refundedFils: toFils(num(row.refunded_total)),
    targetPoints: Number(row.target_points),
    reversedPoints: Number(row.reversed_points),
    shortfall: Number(row.shortfall),
    balanceAfter: Number(row.balance_after),
    reason: row.reason as string,
    createdAt: iso(row.created_at)!,
  };
}

/** A pos_point_spends row → TillSpend. `value_jod` is numeric (a string). */
function toTillSpend(row: Record<string, unknown>): TillSpend {
  const intOrNull = (v: unknown) => (v == null ? null : Number(v));
  return {
    posOrderRef: row.pos_order_ref as string,
    memberId: row.member_id as string,
    points: Number(row.points),
    valueJod: num(row.value_jod),
    slices: (row.slices ?? []) as SpentSlice[],
    pointsBalanceAfter: Number(row.points_balance_after),
    status: row.status as TillSpend['status'],
    returnedPoints: intOrNull(row.returned_points),
    expiredPoints: intOrNull(row.expired_points),
    reverseBalanceAfter: intOrNull(row.reverse_balance_after),
    reverseReason: (row.reverse_reason ?? null) as string | null,
    reversedAt: iso(row.reversed_at),
    createdAt: iso(row.created_at)!,
  };
}

/** A payment_intents row → PaymentIntent. `amount_fils` is bigint (a string). */
function toPaymentIntent(row: Record<string, unknown>): PaymentIntent {
  return {
    id: row.id as string,
    memberId: row.member_id as string,
    amountFils: Number(row.amount_fils),
    currency: 'JOD',
    cartHash: row.cart_hash as string,
    provider: row.provider as string,
    providerRef: row.provider_ref as string,
    status: row.status as PaymentIntent['status'],
    captureRef: (row.capture_ref ?? null) as string | null,
    orderId: (row.order_id ?? null) as string | null,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

export function createPostgresBackend(db: Db): Backend {
  /** Load a member, mutate it with the shared rules, write it back — all inside
   *  one transaction holding a row lock, so two concurrent checkouts cannot
   *  both read the same balance and both spend it.
   *
   *  `FOR NO KEY UPDATE`, not `FOR UPDATE`: every writer here takes the same
   *  mode, and it conflicts with itself, so money operations on one member are
   *  still strictly serial. What it does NOT conflict with is `FOR KEY SHARE` —
   *  the lock Postgres takes on the parent row to check a foreign key. With
   *  `FOR UPDATE`, inserting an order or a corporate use for a member (any
   *  session, any reason) queued behind whoever held that member's row; the
   *  member's id never changes, so there was nothing for that wait to protect. */
  async function withMember<T>(
    id: string,
    fn: (
      m: Member, log: (e: HistoryEntry) => void, t: Db, logged: readonly HistoryEntry[],
    ) => Promise<T> | T,
  ): Promise<T> {
    return db.tx(async (t) => {
      const rows = await t.query<MemberRow>('select * from members where id = $1 for no key update', [id]);
      if (!rows[0]) throw notFound('member not found');
      const m = toMember(rows[0]);
      const lines: HistoryEntry[] = [];
      const out = await fn(m, (e) => lines.push(e), t, lines);
      await saveMember(t, m);
      for (const e of lines) {
        await t.query(
          `insert into point_history (member_id, delta_points, reason_ar, reason_en, created_at)
           values ($1,$2,$3,$4,$5)`,
          [id, e.deltaPoints, e.reasonAr, e.reasonEn, e.createdAt],
        );
      }
      return out;
    });
  }

  async function saveMember(t: Db, m: Member): Promise<void> {
    await t.query(
      `update members set name=$2, birthday=$3, profile_bonus_at=$4, lots=$5,
         expiry_settled_through=$6, wallet_lots=$7, wallet_expiry_settled_through=$8,
         spend=$9, held_tier_id=$10, evaluated_through=$11
       where id=$1`,
      [
        m.id, m.name, m.birthday, m.profileBonusAt, JSON.stringify(m.lots),
        m.expirySettledThrough, JSON.stringify(m.walletLots), m.walletExpirySettledThrough,
        JSON.stringify(m.spend), m.heldTierId, m.evaluatedThrough,
      ],
    );
  }

  // ---- the same three helpers the memory backend has, verbatim in effect ----

  const settleExpiry = (m: Member, at: Date, log: (e: HistoryEntry) => void): void => {
    const today = ammanDayKey(at);
    const lost = expiredBetween(m.lots, m.expirySettledThrough, today);
    if (lost > 0) {
      log({
        deltaPoints: -lost, reasonAr: 'انتهاء صلاحية نقاط',
        reasonEn: 'Points expired', createdAt: at.toISOString(),
      });
    }
    m.expirySettledThrough = today;
    m.lots = pruneLots(m.lots, at, LOTS);
  };

  const settleWalletExpiry = (m: Member, at: Date, log: (e: HistoryEntry) => void): void => {
    const today = ammanDayKey(at);
    const lostFils = expiredBetween(m.walletLots, m.walletExpirySettledThrough, today);
    if (lostFils > 0) {
      const lostJod = (lostFils / 1000).toFixed(3);
      log({
        deltaPoints: 0,
        reasonAr: `انتهاء صلاحية رصيد (${lostJod} د.أ)`,
        reasonEn: `Wallet balance expired (${lostJod} JOD)`,
        createdAt: at.toISOString(),
      });
    }
    m.walletExpirySettledThrough = today;
    m.walletLots = pruneLots(m.walletLots, at, WALLET_LOTS);
  };

  const runDueEvaluation = (m: Member, at: Date): Evaluation[] => {
    const due = evaluate(m.spend, m.heldTierId, m.evaluatedThrough, WINDOW, at);
    for (const e of due) {
      m.heldTierId = holdRung(
        m.heldTierId, qualifiedRung(e.windowSpend, e.visitDays, WINDOW), WINDOW,
      ).id as TierId;
      m.evaluatedThrough = e.period;
    }
    return due;
  };

  /** recordSpend's body, shared with checkout so the window has ONE writer. */
  const applySpend = (
    m: Member, jod: number, at: Date, log: (e: HistoryEntry) => void, occurredOn?: string,
  ): void => {
    settleExpiry(m, at, log);
    runDueEvaluation(m, at);
    m.spend.push(occurredOn ? { jod, day: occurredOn } : spendEntry(jod, at));
    m.spend = pruneSpend(m.spend, WINDOW, at);
    m.heldTierId = holdRung(
      m.heldTierId,
      qualifiedRung(
        qualifyingSpend(m.spend, WINDOW, at),
        qualifyingVisitDays(m.spend, WINDOW, at), WINDOW,
      ),
      WINDOW,
    ).id as TierId;
  };

  /**
   * Decide the second-visit voucher for a member ALREADY LOCKED by the caller's
   * transaction, and insert the row the decision produces.
   *
   * `pendingLedger` is the sum of ledger lines this transaction has logged but
   * not yet inserted (withMember writes them after its callback). Leaving them
   * out would compute `unexplainedPoints` against a ledger missing its newest
   * lines — the one number the 19,040 JOD over-issue guard rests on.
   */
  async function decideVoucherIn(
    t: Db, m: Member,
    input: { orderId: string; basketHasDrink: boolean; arm: HoldoutStamp; at: Date },
    pendingLedger: number,
  ): Promise<SecondVisitVoucher | null> {
    const existing = await t.query(
      'select * from second_visit_vouchers where member_id = $1', [m.id],
    );
    if (existing[0]) return null;      // once per member, ever

    // Every input computed exactly as the memory backend computes it — the
    // 19,040 JOD over-issue guard rests on `unexplainedPoints` being the
    // balance MINUS what this BFF itself granted, so the sum is over the
    // whole ledger (both signs), not just the debits.
    const ledger = await t.query<{ n: string }>(
      'select coalesce(sum(delta_points),0)::text as n from point_history where member_id = $1',
      [m.id],
    );
    const prior = await t.query<{ n: string }>(
      'select count(*)::text as n from orders where member_id = $1 and id <> $2',
      [m.id, input.orderId],
    );
    const decision = decideSecondVisit({
      memberId: m.id,
      orderId: input.orderId,
      voucherId: `svv_${randomUUID()}`,
      basketHasDrink: input.basketHasDrink,
      arm: input.arm,
      alreadyEvaluated: false,          // checked above: a row means never again
      priorTransactions: Number(prior[0]?.n ?? 0),
      unexplainedPoints:
        liveBalance(m.lots, input.at) - Number(ledger[0]?.n ?? 0) - pendingLedger,
      priorWindowSpend: qualifyingSpend(m.spend, WINDOW, input.at),
      at: input.at,
    });

    const row = decision.row;
    if (!row) return null;
    await t.query(
      `insert into second_visit_vouchers (member_id, outcome, arm, issued_at, expires_at, redeemed_at)
       values ($1,$2,$3,$4,$5,$6)`,
      [m.id, row.outcome, input.arm, row.issuedAt, row.expiresAt, row.redeemedAt],
    );
    return row.outcome === 'issued' ? row : null;
  }

  const sumDeltas = (lines: readonly HistoryEntry[]) => lines.reduce((s, e) => s + e.deltaPoints, 0);

  /** Last time THIS backend object deleted expired idempotency keys. Per
   *  process, which is fine: the sweep reclaims space, it guards nothing. */
  let idemSweptAt = 0;

  const toRedemption = (r: Record<string, unknown>): RedemptionRow => ({
    id: r.id as string, memberId: r.member_id as string, code: r.code as string,
    points: Number(r.points), valueJod: num(r.value_jod),
    createdAt: iso(r.created_at)!, expiresAt: iso(r.expires_at)!,
    settledAt: iso(r.settled_at), cancelledAt: iso(r.cancelled_at),
    settledVia: (r.settled_via ?? null) as RedemptionRow['settledVia'],
  });

  /** Refund every expired, unused code. Runs inside the caller's transaction so
   *  a sweep and the spend that follows it cannot interleave. */
  async function sweep(t: Db, m: Member, at: Date, log: (e: HistoryEntry) => void): Promise<number> {
    const rows = await t.query(
      `select * from redemptions
       where member_id = $1 and settled_at is null and cancelled_at is null
       for update`,
      [m.id],
    );
    let n = 0;
    for (const raw of rows) {
      const row = toRedemption(raw);
      if (!shouldRefund(row, at)) continue;
      await t.query('update redemptions set cancelled_at = $2 where id = $1', [row.id, at.toISOString()]);
      m.lots = grantLot(m.lots, row.points, 'earn', at, LOTS).lots;
      log({
        deltaPoints: row.points, reasonAr: 'انتهت صلاحية الاستبدال',
        reasonEn: 'Redemption expired', createdAt: at.toISOString(),
      });
      n += 1;
    }
    return n;
  }

  const newCode = async (t: Db): Promise<string> => {
    for (;;) {
      let out = '';
      for (let i = 0; i < REDEMPTION_CODE_LENGTH; i += 1) {
        out += REDEMPTION_ALPHABET[randomInt(REDEMPTION_ALPHABET.length)];
      }
      const clash = await t.query('select 1 from redemptions where code = $1', [out]);
      if (clash.length === 0) return out;
    }
  };

  const api: Backend = {
    async findOrCreateByPhone(phone, name) {
      return db.tx(async (t) => {
        const found = await t.query<MemberRow>('select * from members where phone = $1', [phone]);
        if (found[0]) return toMember(found[0]);
        const m: Member = {
          id: `m_${randomUUID()}`, phone, name: normalizeName(name), birthday: null,
          profileBonusAt: null,
          lots: [], expirySettledThrough: todayKey(),
          walletLots: [], walletExpirySettledThrough: todayKey(),
          spend: [], heldTierId: 'base',
          evaluatedThrough: evaluationPeriod(todayKey(), WINDOW.evaluation),
        };
        // 🔴 ON CONFLICT, because the select above is not a lock. Two first
        // sign-ins for one phone — a double-tapped "verify", or the app and
        // the website at once — both find nothing and both insert. Measured on
        // a real Postgres pool (bff/test/resilience-concurrency R1.9): five of
        // six parallel calls died on members_phone_key (23505), i.e. HTTP 500
        // at /v1/auth/otp/verify. Under READ COMMITTED `do nothing` waits for
        // the other insert to commit, so the re-select below then sees it and
        // every caller gets the ONE member.
        const inserted = await t.query(
          `insert into members (id, phone, name, birthday, profile_bonus_at, lots,
             expiry_settled_through, wallet_lots, wallet_expiry_settled_through, spend,
             held_tier_id, evaluated_through)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           on conflict (phone) do nothing
           returning id`,
          [m.id, m.phone, m.name, m.birthday, m.profileBonusAt, JSON.stringify(m.lots),
            m.expirySettledThrough, JSON.stringify(m.walletLots), m.walletExpirySettledThrough,
            JSON.stringify(m.spend), m.heldTierId, m.evaluatedThrough],
        );
        if (inserted[0]) return m;
        const winner = await t.query<MemberRow>('select * from members where phone = $1', [phone]);
        if (!winner[0]) throw new Error(`findOrCreateByPhone: lost the insert race for ${phone} but found no row`);
        return toMember(winner[0]);
      });
    },

    async getMember(id) {
      const rows = await db.query<MemberRow>('select * from members where id = $1', [id]);
      if (!rows[0]) throw notFound('member not found');
      return toMember(rows[0]);
    },

    async findMemberByPhone(phone) {
      const rows = await db.query<MemberRow>('select * from members where phone = $1', [phone]);
      return rows[0] ? toMember(rows[0]) : null;
    },

    async debitWallet(id, fils) {
      return withMember(id, (m, log) => {
        const at = new Date();
        settleWalletExpiry(m, at, log);
        const res = consumeFifo(m.walletLots, fils, at);
        if (!res.ok) throw conflict('insufficient_wallet', 'Wallet balance is not enough');
        m.walletLots = res.lots;
        return liveBalance(m.walletLots, at);
      });
    },

    async creditWallet(id, fils, source) {
      return withMember(id, (m, log) => {
        const at = new Date();
        settleWalletExpiry(m, at, log);
        m.walletLots = grantLot(m.walletLots, fils, source, at, WALLET_LOTS).lots;
        return liveBalance(m.walletLots, at);
      });
    },

    async addPoints(id, delta, reasonAr, reasonEn) {
      if (delta < 0) throw conflict('negative_grant', 'A grant cannot be negative');
      return withMember(id, (m, log) => {
        const at = new Date();
        settleExpiry(m, at, log);
        m.lots = grantLot(m.lots, delta, 'earn', at, LOTS).lots;
        log({ deltaPoints: delta, reasonAr, reasonEn, createdAt: at.toISOString() });
        return liveBalance(m.lots, at);
      });
    },

    async spendPoints(id, points, reasonAr, reasonEn) {
      return withMember(id, (m, log) => {
        const at = new Date();
        settleExpiry(m, at, log);
        const res = consumeFifo(m.lots, points, at);
        if (!res.ok) throw conflict('insufficient_points', 'Not enough points');
        m.lots = res.lots;
        log({ deltaPoints: -points, reasonAr, reasonEn, createdAt: at.toISOString() });
        return liveBalance(m.lots, at);
      });
    },

    async setProfile(id, profile) {
      return withMember(id, (m, log) => {
        const name = normalizeName(profile.name);
        const bonus = profileBonusFor({ name, birthday: profile.birthday }, m.profileBonusAt !== null);
        m.name = name;
        m.birthday = profile.birthday;
        const at = new Date();
        let pointsBalance = liveBalance(m.lots, at);
        if (bonus > 0) {
          // Stamp first, then grant — an over-stamped member is merely unpaid
          // and visible; an unstamped one can be paid twice on retry.
          m.profileBonusAt = at.toISOString();
          settleExpiry(m, at, log);
          m.lots = grantLot(m.lots, bonus, 'earn', at, LOTS).lots;
          log({
            deltaPoints: bonus, reasonAr: 'إكمال الملف الشخصي',
            reasonEn: 'Profile completed', createdAt: at.toISOString(),
          });
          pointsBalance = liveBalance(m.lots, at);
        }
        return { profile: { name, birthday: m.birthday }, bonusGranted: bonus, pointsBalance };
      });
    },

    async recordSpend(id, jod, occurredOn) {
      await withMember(id, (m, log) => applySpend(m, jod, new Date(), log, occurredOn));
    },

    async getStanding(id) {
      const m = await api.getMember(id);
      return standing(m.spend, m.heldTierId, WINDOW);
    },

    async evaluateTier(id, at) {
      return withMember(id, (m) => runDueEvaluation(m, at ?? new Date()));
    },

    async createOrder(o: NewOrder) {
      const rec: OrderRecord = { ...o, id: `ord_${randomUUID()}`, createdAt: new Date().toISOString() };
      await db.query(
        `insert into orders (id, member_id, branch_id, order_type, payment_method, total, created_at)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [rec.id, rec.memberId, rec.branchId, rec.type, rec.paymentMethod, rec.total, rec.createdAt],
      );
      return rec;
    },

    async recordEarnBreakdown(orderId, breakdown) {
      const done = await db.query(
        'update orders set earn_breakdown = $2 where id = $1 returning id',
        [orderId, JSON.stringify(breakdown)],
      );
      if (done.length === 0) throw notFound('order not found');
    },

    async getHistory(id) {
      await api.getMember(id);           // notFound for an unknown member, as memory does
      const rows = await db.query(
        `select delta_points, reason_ar, reason_en, created_at
         from point_history where member_id = $1 order by id desc`,
        [id],
      );
      return rows.map((r) => ({
        deltaPoints: Number(r.delta_points),
        reasonAr: r.reason_ar as string,
        reasonEn: r.reason_en as string,
        createdAt: iso(r.created_at)!,
      })) as HistoryEntry[];
    },

    // ---- second-visit voucher ----
    async evaluateSecondVisitVoucher(input) {
      return db.tx(async (t) => {
        const rows = await t.query<MemberRow>(
          'select * from members where id = $1 for no key update', [input.memberId],
        );
        if (!rows[0]) throw notFound('member not found');
        return decideVoucherIn(t, toMember(rows[0]), input, 0);
      });
    },

    async getSecondVisitVoucher(memberId) {
      const rows = await db.query('select * from second_visit_vouchers where member_id = $1', [memberId]);
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        memberId, outcome: r.outcome, issuedAt: iso(r.issued_at),
        expiresAt: iso(r.expires_at), redeemedAt: iso(r.redeemed_at),
      } as unknown as SecondVisitVoucher;
    },

    async redeemSecondVisitVoucher(memberId, at) {
      return db.tx(async (t) => {
        const rows = await t.query(
          'select * from second_visit_vouchers where member_id = $1 for update', [memberId],
        );
        const r = rows[0];
        if (!r || r.outcome !== 'issued') throw notFound('no voucher');
        if (r.redeemed_at) throw conflict('voucher_already_redeemed', 'This voucher has already been used');
        const view = {
          memberId, outcome: r.outcome, issuedAt: iso(r.issued_at),
          expiresAt: iso(r.expires_at), redeemedAt: null,
        } as unknown as SecondVisitVoucher;
        if (secondVisitStatus(view, at) === 'expired') {
          throw conflict('voucher_expired', 'This voucher has expired');
        }
        await t.query(
          'update second_visit_vouchers set redeemed_at = $2 where member_id = $1',
          [memberId, at.toISOString()],
        );
        return { ...view, redeemedAt: at.toISOString() } as SecondVisitVoucher;
      });
    },

    // ---- redemptions ----
    async createRedemption(id, points) {
      return withMember(id, async (m, log, t) => {
        const at = new Date();
        await sweep(t, m, at, log);
        settleExpiry(m, at, log);
        const res = consumeFifo(m.lots, points, at);
        if (!res.ok) throw conflict('insufficient_points', 'Not enough points');
        m.lots = res.lots;
        log({
          deltaPoints: -points, reasonAr: 'استبدال نقاط',
          reasonEn: 'Points redeemed', createdAt: at.toISOString(),
        });
        const row: RedemptionRow = {
          id: `rdm_${randomUUID()}`, memberId: id, code: await newCode(t), points,
          valueJod: jodFromPoints(points),
          createdAt: at.toISOString(),
          expiresAt: redemptionExpiresAt(at, loyalty.REDEMPTION_TTL_SECONDS),
          settledAt: null, cancelledAt: null, settledVia: null,
        };
        await t.query(
          `insert into redemptions (id, member_id, code, points, value_jod, created_at, expires_at)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [row.id, row.memberId, row.code, row.points, row.valueJod, row.createdAt, row.expiresAt],
        );
        return row;
      });
    },

    async findRedemptionByCode(code) {
      const c = normalizeRedemptionCode(code);
      if (!c) return null;
      const rows = await db.query('select * from redemptions where code = $1', [c]);
      return rows[0] ? toRedemption(rows[0]) : null;
    },

    async activeRedemption(id) {
      const now = new Date();
      await api.sweepRedemptions(id, now);
      const rows = await db.query(
        `select * from redemptions
         where member_id = $1 and settled_at is null and cancelled_at is null
           and expires_at > $2
         order by created_at desc limit 1`,
        [id, now.toISOString()],
      );
      return rows[0] ? toRedemption(rows[0]) : null;
    },

    async settleRedemption(rid, via, at) {
      return db.tx(async (t) => {
        const rows = await t.query('select * from redemptions where id = $1 for update', [rid]);
        if (!rows[0]) throw notFound('redemption not found');
        const row = toRedemption(rows[0]);
        if (row.settledAt) throw conflict('redemption_already_settled', 'This code has already been used');
        if (row.cancelledAt) throw conflict('redemption_cancelled', 'This code was cancelled');
        if (!isRedeemable(row, at)) throw conflict('redemption_expired', 'This code has expired');
        await t.query(
          'update redemptions set settled_at = $2, settled_via = $3 where id = $1',
          [rid, at.toISOString(), via],
        );
        return { ...row, settledAt: at.toISOString(), settledVia: via };
      });
    },

    async cancelRedemption(id, rid, at) {
      return withMember(id, async (m, log, t) => {
        const rows = await t.query('select * from redemptions where id = $1 for update', [rid]);
        if (!rows[0] || rows[0].member_id !== id) throw notFound('redemption not found');
        const row = toRedemption(rows[0]);
        if (row.settledAt) throw conflict('redemption_already_settled', 'This code has already been used');
        if (row.cancelledAt) return row;                       // idempotent
        await t.query('update redemptions set cancelled_at = $2 where id = $1', [rid, at.toISOString()]);
        settleExpiry(m, at, log);
        m.lots = grantLot(m.lots, row.points, 'earn', at, LOTS).lots;
        log({
          deltaPoints: row.points, reasonAr: 'إلغاء استبدال',
          reasonEn: 'Redemption cancelled', createdAt: at.toISOString(),
        });
        return { ...row, cancelledAt: at.toISOString() };
      });
    },

    async sweepRedemptions(id, at) {
      return withMember(id, (m, log, t) => sweep(t, m, at, log));
    },

    // ---- corporate register ----
    async listCompanies() {
      const rows = await db.query('select * from companies order by id');
      return rows.map((r) => ({
        id: r.id as string, nameAr: r.name_ar as string, nameEn: r.name_en as string,
        percentOff: num(r.percent_off), active: r.active as boolean,
      }));
    },

    async saveCompany(c) {
      await db.query(
        `insert into companies (id, name_ar, name_en, percent_off, active)
         values ($1,$2,$3,$4,$5)
         on conflict (id) do update set
           name_ar = excluded.name_ar, name_en = excluded.name_en,
           percent_off = excluded.percent_off, active = excluded.active`,
        [c.id, c.nameAr, c.nameEn, c.percentOff, c.active],
      );
      return c;
    },

    async replaceRoster(companyId, entries) {
      return db.tx(async (t) => {
        // REPLACE, in one transaction: a merge would leave last quarter's
        // leavers holding the discount for ever, and a delete followed by a
        // failed insert would leave the company with nobody.
        await t.query('delete from corporate_roster where company_id = $1', [companyId]);
        for (const e of buildRosterIndex(entries).values()) {
          await t.query(
            `insert into corporate_roster (phone, company_id, name) values ($1,$2,$3)
             on conflict (phone) do update set company_id = excluded.company_id, name = excluded.name`,
            [e.phone, companyId, e.name ?? null],
          );
        }
        const n = await t.query<{ n: string }>(
          'select count(*)::text as n from corporate_roster where company_id = $1', [companyId],
        );
        return Number(n[0]?.n ?? 0);
      });
    },

    async listRoster(companyId) {
      const rows = companyId
        ? await db.query('select * from corporate_roster where company_id = $1 order by phone', [companyId])
        : await db.query('select * from corporate_roster order by phone');
      return rows.map((r) => ({
        phone: r.phone as string, companyId: r.company_id as string,
        ...(r.name ? { name: r.name as string } : {}),
      })) as CorporateMemberEntry[];
    },

    async entitlementFor(memberId) {
      const rows = await db.query<MemberRow>('select phone from members where id = $1', [memberId]);
      if (!rows[0]) return null;
      // Resolved by the SHARED predicate, from the phone OTP proved — so the
      // "switched off" and "deleted company" cases cannot answer differently
      // here than they do in the memory backend.
      const companies = await api.listCompanies();
      const roster = buildRosterIndex(await api.listRoster());
      return resolveEntitlement(rows[0].phone, companies as CompanyDiscount[], roster);
    },

    async recordCorporateUse(use) {
      const row: CorporateUse = { ...use, id: `cuse_${randomUUID()}` };
      await db.query(
        `insert into corporate_uses (id, member_id, company_id, phone, used_at, order_id,
           items, percent_off, discount_jod)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [row.id, row.memberId, row.companyId, row.phone, row.at, row.orderId,
          JSON.stringify(row.items), row.percentOff, row.discountJod],
      );
      return row;
    },

    async listCorporateUses(filter) {
      const where: string[] = [];
      const args: unknown[] = [];
      const add = (clause: string, v: unknown) => { args.push(v); where.push(clause.replace('?', `$${args.length}`)); };
      if (filter?.companyId) add('company_id = ?', filter.companyId);
      if (filter?.memberId) add('member_id = ?', filter.memberId);
      if (filter?.from) add('used_at >= ?', filter.from);
      if (filter?.to) add('used_at <= ?', filter.to);
      const rows = await db.query(
        `select * from corporate_uses ${where.length ? `where ${where.join(' and ')}` : ''}
         order by used_at desc`,
        args,
      );
      return rows.map((r) => ({
        id: r.id as string, memberId: r.member_id as string, companyId: r.company_id as string,
        phone: r.phone as string, at: iso(r.used_at)!, orderId: (r.order_id ?? null) as string | null,
        items: (r.items ?? []) as CorporateUse['items'],
        percentOff: num(r.percent_off), discountJod: num(r.discount_jod),
      }));
    },

    // ---- composite money movements: one transaction each ----
    async checkout(id, input) {
      // ONE withMember: the member row is locked FOR UPDATE for the whole of
      // it, and every statement below commits together or not at all. A
      // process that dies anywhere in here leaves the wallet as it was and no
      // order — there is no compensation left to run, because nothing
      // half-happened (bff/test/resilience-restart.test.ts R2.8).
      return withMember(id, async (m, log, t, logged) => {
        const { at } = input;
        // The card payment, locked and checked BEFORE anything moves — the
        // same rule the memory store applies (payments/intent.ts). Locked, so
        // two checkouts presenting one payment are serial and the second finds
        // it spent; the UNIQUE(order_id) constraint is the guarantee beneath.
        if (input.payment) {
          const pis = await t.query('select * from payment_intents where id = $1 for update', [input.payment.intentId]);
          assertIntentSpendable(pis[0] ? toPaymentIntent(pis[0]) : null, id, input.payment);
        }
        if (input.walletDebitFils > 0) {
          settleWalletExpiry(m, at, log);
          const res = consumeFifo(m.walletLots, input.walletDebitFils, at);
          if (!res.ok) throw conflict('insufficient_wallet', 'Wallet balance is not enough');
          m.walletLots = res.lots;
        }
        const order: OrderRecord = {
          ...input.order, memberId: id, pointsEarned: input.pointsEarned,
          id: `ord_${randomUUID()}`, createdAt: at.toISOString(),
          ...(input.earn ? { earn: input.earn } : {}),
        };
        // payment_intent_id is UNIQUE: the database refuses a second order that
        // names a payment already spent (20260927), whatever the check above.
        await t.query(
          `insert into orders (id, member_id, branch_id, order_type, payment_method, total,
             earn_breakdown, created_at, payment_intent_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [order.id, id, order.branchId, order.type, order.paymentMethod, order.total,
            input.earn ? JSON.stringify(input.earn) : null, order.createdAt,
            input.payment?.intentId ?? null],
        );
        if (input.payment) {
          await t.query(
            `update payment_intents set status = $2, capture_ref = $3, order_id = $4, updated_at = $5
             where id = $1`,
            [input.payment.intentId, 'captured', input.payment.captureRef, order.id, at.toISOString()],
          );
        }

        // Settled BEFORE the voucher, as the memory backend's decideVoucher
        // does, so both compute `unexplainedPoints` on the same ledger.
        settleExpiry(m, at, log);
        // 🔴 A SAVEPOINT, because the voucher must never fail a paid order,
        // and inside one transaction a failed statement would otherwise poison
        // everything after it. Rolled back to here, the order and the debit
        // stand and no voucher row is left behind.
        let secondVisitVoucher: SecondVisitVoucher | null = null;
        let secondVisitError: unknown = null;
        await t.query('savepoint second_visit');
        try {
          secondVisitVoucher = await decideVoucherIn(
            t, m, { orderId: order.id, ...input.secondVisit, at }, sumDeltas(logged),
          );
          await t.query('release savepoint second_visit');
        } catch (e) {
          secondVisitError = e;
          await t.query('rollback to savepoint second_visit');
        }

        if (input.corporateUse) {
          const u = input.corporateUse;
          await t.query(
            `insert into corporate_uses (id, member_id, company_id, phone, used_at, order_id,
               items, percent_off, discount_jod)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [`cuse_${randomUUID()}`, id, u.companyId, m.phone, at.toISOString(), order.id,
              JSON.stringify(u.items), u.percentOff, u.discountJod],
          );
        }
        if (input.pointsEarned < 0) throw conflict('negative_grant', 'A grant cannot be negative');
        m.lots = grantLot(m.lots, input.pointsEarned, 'earn', at, LOTS).lots;
        log({
          deltaPoints: input.pointsEarned, reasonAr: input.pointsReasonAr,
          reasonEn: input.pointsReasonEn, createdAt: at.toISOString(),
        });
        if (input.spendJod !== null) applySpend(m, input.spendJod, at, log);
        return {
          order,
          pointsBalance: liveBalance(m.lots, at),
          walletBalanceFils: liveBalance(m.walletLots, at),
          secondVisitVoucher,
          secondVisitError,
        };
      });
    },

    async topUpWallet(id, fils, bonusPoints, reasonAr, reasonEn) {
      if (bonusPoints < 0) throw conflict('negative_grant', 'A grant cannot be negative');
      return withMember(id, (m, log) => {
        const at = new Date();
        settleWalletExpiry(m, at, log);
        m.walletLots = grantLot(m.walletLots, fils, 'topup', at, WALLET_LOTS).lots;
        if (bonusPoints > 0) {
          settleExpiry(m, at, log);
          m.lots = grantLot(m.lots, bonusPoints, 'earn', at, LOTS).lots;
          log({ deltaPoints: bonusPoints, reasonAr, reasonEn, createdAt: at.toISOString() });
        }
        return { walletBalanceFils: liveBalance(m.walletLots, at), pointsBalance: liveBalance(m.lots, at) };
      });
    },

    // ---- the till's earn (pos_sales) ----
    async tillEarn(input) {
      // ONE withMember: the member lock opens it, and the grant, its ledger
      // line, the window spend and the sale row commit together or not at all.
      return withMember(input.memberId, async (m, log, t) => {
        const { at } = input;
        const found = await t.query('select * from pos_sales where pos_order_ref = $1 for update', [input.posOrderRef]);
        if (found[0]) {
          const sale = toTillSale(found[0]);
          assertSameSale(sale, input);
          return { sale, replay: true };
        }
        // The ticket belongs to ONE member, so a second sale on it is
        // serialised behind this lock and found here; UNIQUE(earn_ticket_jti)
        // is the guarantee beneath.
        const spent = await t.query('select pos_order_ref from pos_sales where earn_ticket_jti = $1', [input.ticketJti]);
        if (spent[0]) throw earnTicketUsed();
        if (input.ticketRefusal) throw ticketRefusalError(input.ticketRefusal);
        if (input.pointsEarned < 0) throw conflict('negative_grant', 'A grant cannot be negative');
        settleExpiry(m, at, log);
        m.lots = grantLot(m.lots, input.pointsEarned, 'earn', at, LOTS).lots;
        log({
          deltaPoints: input.pointsEarned, reasonAr: input.reasonAr,
          reasonEn: input.reasonEn, createdAt: at.toISOString(),
        });
        // The day the spend is dated on is STORED, so a reversal can find it.
        const spendDay = input.spendJod !== null && input.spendJod > 0 ? (input.spendDay ?? ammanDayKey(at)) : null;
        if (input.spendJod !== null && spendDay !== null) applySpend(m, input.spendJod, at, log, spendDay);
        const sale: TillSale = {
          posOrderRef: input.posOrderRef, memberId: m.id, branchId: input.branchId,
          paidFils: input.paidFils, paidAt: input.paidAt.toISOString(), spendDay,
          pointsEarned: input.pointsEarned, pointsBalanceAfter: liveBalance(m.lots, at),
          earn: input.earn, status: 'earned', refundedFils: 0,
          reversedPoints: null, shortfall: null, reverseBalanceAfter: null,
          reverseReason: null, reversedAt: null, createdAt: at.toISOString(),
        };
        // 🔴 ON CONFLICT DO NOTHING, because the SELECT above is not a lock on
        // a row that does not exist yet. The same reference reported for a
        // DIFFERENT member (two tills, one typo) is not serialised by this
        // member's lock: the second insert waits for the first to commit, then
        // does nothing — and this sale is refused, its grant rolled back.
        const inserted = await t.query(
          `insert into pos_sales (pos_order_ref, member_id, branch_id, earn_ticket_jti, paid_total,
             paid_at, spend_day, points_earned, points_balance_after, earn_breakdown, status, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           on conflict do nothing
           returning pos_order_ref`,
          [sale.posOrderRef, sale.memberId, sale.branchId, input.ticketJti, toJod(sale.paidFils),
            sale.paidAt, sale.spendDay, sale.pointsEarned, sale.pointsBalanceAfter,
            sale.earn ? JSON.stringify(sale.earn) : null, sale.status, sale.createdAt],
        );
        if (!inserted[0]) throw posOrderConflict();
        return { sale, replay: false };
      });
    },

    async reverseTillEarn(posOrderRef, reason, at, refund) {
      // Whose sale it is, read BEFORE the transaction — the member lock must be
      // the first statement of it (R1.8), and a sale's member never changes.
      const owner = await db.query<{ member_id: string }>(
        'select member_id from pos_sales where pos_order_ref = $1', [posOrderRef],
      );
      if (!owner[0]) throw notFound('pos sale not found');
      return withMember(owner[0].member_id, async (m, log, t) => {
        const rows = await t.query('select * from pos_sales where pos_order_ref = $1 for update', [posOrderRef]);
        const sale = toTillSale(rows[0]);
        // A replay first — even of a sale reversed since — then the refusals.
        const found = refund
          ? await t.query('select * from pos_sale_refunds where refund_ref = $1', [refund.refundRef])
          : await t.query('select * from pos_sale_refunds where pos_order_ref = $1 and refund_ref is null', [posOrderRef]);
        if (found[0]) {
          const stored = toTillRefund(found[0]);
          if (refund) assertSameRefund(stored, posOrderRef, refund);
          return { sale, refund: stored, replay: true };
        }
        if (sale.status === 'reversed') {
          if (refund) throw saleAlreadyReversed();
          return { sale, refund: syntheticFullRefund(sale), replay: true };
        }
        const plan = planOrRefuse(sale, refund);
        settleExpiry(m, at, log);
        const back = applyTillRefund(m.lots, m.spend, refundable(sale), plan, at);
        m.lots = back.lots;
        m.spend = back.spend;
        const { reasonAr, reasonEn } = refundReasons(!!refund);
        log({ deltaPoints: -back.reversedPoints, reasonAr, reasonEn, createdAt: at.toISOString() });
        const balanceAfter = liveBalance(m.lots, at);
        const row: TillRefund = {
          refundRef: refund ? refund.refundRef : null, posOrderRef, memberId: m.id,
          refundedFils: plan.refundFils, targetPoints: plan.targetPoints,
          reversedPoints: back.reversedPoints, shortfall: back.shortfall,
          balanceAfter, reason, createdAt: at.toISOString(),
        };
        // ON CONFLICT DO NOTHING: the same refund reference reported for
        // ANOTHER sale — another member's, so not serialised by this lock — is
        // refused here and this refund rolled back whole.
        const inserted = await t.query(
          `insert into pos_sale_refunds (refund_ref, pos_order_ref, member_id, refunded_total, target_points,
             reversed_points, shortfall, balance_after, reason, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           on conflict do nothing
           returning id`,
          [row.refundRef, posOrderRef, m.id, toJod(row.refundedFils), row.targetPoints,
            row.reversedPoints, row.shortfall, row.balanceAfter, row.reason, row.createdAt],
        );
        if (!inserted[0]) throw refundConflict();
        let next: TillSale = { ...sale, refundedFils: plan.refundedFilsAfter };
        if (plan.completes) {
          // Totals across EVERY refund of the sale, this one included.
          const all = await t.query('select reversed_points, shortfall from pos_sale_refunds where pos_order_ref = $1', [posOrderRef]);
          next = {
            ...next, status: 'reversed',
            reversedPoints: all.reduce((n, r) => n + Number(r.reversed_points), 0),
            shortfall: all.reduce((n, r) => n + Number(r.shortfall), 0),
            reverseBalanceAfter: balanceAfter, reverseReason: reason, reversedAt: at.toISOString(),
          };
        }
        await t.query(
          `update pos_sales set refunded_total = $2, status = $3, reversed_points = $4, shortfall = $5,
             reverse_balance_after = $6, reverse_reason = $7, reversed_at = $8
           where pos_order_ref = $1`,
          [posOrderRef, toJod(next.refundedFils), next.status, next.reversedPoints, next.shortfall,
            next.reverseBalanceAfter, next.reverseReason, next.reversedAt],
        );
        return { sale: next, refund: row, replay: false };
      });
    },

    async getTillSale(posOrderRef) {
      const rows = await db.query('select * from pos_sales where pos_order_ref = $1', [posOrderRef]);
      return rows[0] ? toTillSale(rows[0]) : null;
    },

    // ---- points as a tender at the till (pos_point_spends) ----
    async tillSpend(input) {
      // ONE withMember: the member lock opens it, and the debit, its ledger
      // line and the spend row commit together or not at all.
      return withMember(input.memberId, async (m, log, t) => {
        const { at } = input;
        const found = await t.query('select * from pos_point_spends where pos_order_ref = $1 for update', [input.posOrderRef]);
        if (found[0]) {
          const spend = toTillSpend(found[0]);
          assertSameSpend(spend, input);
          return { spend, replay: true };
        }
        // The ticket names ONE member, so a second spend on it is serialised
        // behind this lock and found here; UNIQUE(spend_ticket_jti) beneath.
        const used = await t.query('select pos_order_ref from pos_point_spends where spend_ticket_jti = $1', [input.ticketJti]);
        if (used[0]) throw spendTicketUsed();
        if (input.ticketExpired) throw spendTicketExpired();
        await sweep(t, m, at, log);
        settleExpiry(m, at, log);
        const res = consumeFifo(m.lots, input.points, at);
        if (!res.ok) throw conflict('insufficient_points', 'Not enough points');
        const slices = spentSlices(m.lots, res.consumed);
        m.lots = res.lots;
        log({ deltaPoints: -input.points, reasonAr: input.reasonAr, reasonEn: input.reasonEn, createdAt: at.toISOString() });
        const spend: TillSpend = {
          posOrderRef: input.posOrderRef, memberId: m.id, points: input.points, valueJod: input.valueJod,
          slices, pointsBalanceAfter: liveBalance(m.lots, at), status: 'spent',
          returnedPoints: null, expiredPoints: null, reverseBalanceAfter: null,
          reverseReason: null, reversedAt: null, createdAt: at.toISOString(),
        };
        // ON CONFLICT DO NOTHING: the same reference reported for a DIFFERENT
        // member is not serialised by this member's lock (same shape as
        // tillEarn) — the loser is refused and its debit rolled back.
        const inserted = await t.query(
          `insert into pos_point_spends (pos_order_ref, member_id, spend_ticket_jti, points, value_jod,
             slices, points_balance_after, status, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           on conflict do nothing
           returning pos_order_ref`,
          [spend.posOrderRef, spend.memberId, input.ticketJti, spend.points, spend.valueJod,
            JSON.stringify(spend.slices), spend.pointsBalanceAfter, spend.status, spend.createdAt],
        );
        if (!inserted[0]) throw posSpendConflict();
        return { spend, replay: false };
      });
    },

    async reverseTillSpend(posOrderRef, reason, at) {
      // Whose spend it is, read BEFORE the transaction — the member lock must
      // be the first statement of it (R1.8), and a spend's member never changes.
      const owner = await db.query<{ member_id: string }>(
        'select member_id from pos_point_spends where pos_order_ref = $1', [posOrderRef],
      );
      if (!owner[0]) throw notFound('pos points spend not found');
      return withMember(owner[0].member_id, async (m, log, t) => {
        const rows = await t.query('select * from pos_point_spends where pos_order_ref = $1 for update', [posOrderRef]);
        const spend = toTillSpend(rows[0]);
        if (spend.status === 'reversed') return { spend, replay: true };
        settleExpiry(m, at, log);
        const back = restoreSlices(m.lots, spend.slices, at);
        m.lots = back.lots;
        log({
          deltaPoints: back.restored, reasonAr: 'إرجاع نقاط دفعة ملغاة في الفرع',
          reasonEn: 'Points returned: in-store payment voided', createdAt: at.toISOString(),
        });
        const reversed: TillSpend = {
          ...spend, status: 'reversed', returnedPoints: back.restored, expiredPoints: back.expired,
          reverseBalanceAfter: liveBalance(m.lots, at), reverseReason: reason, reversedAt: at.toISOString(),
        };
        await t.query(
          `update pos_point_spends set status = $2, returned_points = $3, expired_points = $4,
             reverse_balance_after = $5, reverse_reason = $6, reversed_at = $7
           where pos_order_ref = $1`,
          [posOrderRef, reversed.status, reversed.returnedPoints, reversed.expiredPoints,
            reversed.reverseBalanceAfter, reversed.reverseReason, reversed.reversedAt],
        );
        return { spend: reversed, replay: false };
      });
    },

    async getTillSpend(posOrderRef) {
      const rows = await db.query('select * from pos_point_spends where pos_order_ref = $1', [posOrderRef]);
      return rows[0] ? toTillSpend(rows[0]) : null;
    },

    // ---- card payment intents ----
    async createPaymentIntent(intent, at) {
      const row: PaymentIntent = {
        ...intent, status: 'pending', captureRef: null, orderId: null,
        createdAt: at.toISOString(), updatedAt: at.toISOString(),
      };
      await db.query(
        `insert into payment_intents (id, member_id, amount_fils, currency, cart_hash, provider,
           provider_ref, status, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [row.id, row.memberId, row.amountFils, row.currency, row.cartHash, row.provider,
          row.providerRef, row.status, row.createdAt, row.updatedAt],
      );
      return row;
    },

    async getPaymentIntent(intentId) {
      const rows = await db.query('select * from payment_intents where id = $1', [intentId]);
      return rows[0] ? toPaymentIntent(rows[0]) : null;
    },

    async recordPaymentStatus(provider, providerRef, status, at) {
      return db.tx(async (t) => {
        const rows = await t.query(
          'select * from payment_intents where provider = $1 and provider_ref = $2 for update',
          [provider, providerRef],
        );
        if (!rows[0]) return null;
        const intent = toPaymentIntent(rows[0]);
        const next = nextIntentStatus(intent, status);
        if (next === intent.status) return intent;
        await t.query(
          'update payment_intents set status = $2, updated_at = $3 where id = $1',
          [intent.id, next, at.toISOString()],
        );
        return { ...intent, status: next, updatedAt: at.toISOString() };
      });
    },

    // ---- Idempotency-Key store ----
    async claimIdempotencyKey(memberId, key, requestHash, at) {
      const now = at.toISOString();
      const cutoff = new Date(at.getTime() - IDEMPOTENCY_TTL_MS).toISOString();
      if (at.getTime() - idemSweptAt >= IDEMPOTENCY_SWEEP_EVERY_MS) {
        idemSweptAt = at.getTime();
        // Space only — expiry is enforced by the reads below whether or not
        // this ran, so a failed sweep must not fail a payment.
        await db.query('delete from idempotency_keys where created_at < $1', [cutoff])
          .catch(() => { /* the next sweep retries */ });
      }
      // Each statement is atomic on its own, so no transaction is needed: the
      // INSERT is the claim (the primary key admits one row per member+key,
      // and a concurrent insert waits for the first to commit), and the
      // UPDATE re-claims a key whose holder has expired. A row deleted by a
      // release between the two is simply claimed on the next pass.
      for (let pass = 0; pass < 3; pass += 1) {
        const inserted = await db.query(
          `insert into idempotency_keys (member_id, idem_key, request_hash, status, created_at)
           values ($1,$2,$3,$4,$5)
           on conflict (member_id, idem_key) do nothing
           returning member_id`,
          [memberId, key, requestHash, 'pending', now],
        );
        if (inserted.length > 0) return { state: 'claimed' };
        const reclaimed = await db.query(
          `update idempotency_keys
           set request_hash = $3, status = $4, response_code = null, response_body = null, created_at = $5
           where member_id = $1 and idem_key = $2 and created_at < $6
           returning member_id`,
          [memberId, key, requestHash, 'pending', now, cutoff],
        );
        if (reclaimed.length > 0) return { state: 'claimed' };
        const rows = await db.query(
          `select request_hash, status, response_code, response_body
           from idempotency_keys where member_id = $1 and idem_key = $2`,
          [memberId, key],
        );
        const r = rows[0];
        if (!r) continue;                                    // released meanwhile: try again
        if (r.request_hash !== requestHash) return { state: 'mismatch' };
        if (r.status !== 'done') return { state: 'pending' };
        return { state: 'done', statusCode: Number(r.response_code), body: String(r.response_body) };
      }
      // Three passes each raced by a release: someone is churning this key.
      // "In progress" is the answer that cannot move money twice.
      return { state: 'pending' };
    },

    async completeIdempotencyKey(memberId, key, requestHash, statusCode, body) {
      await db.query(
        `update idempotency_keys set status = $4, response_code = $5, response_body = $6
         where member_id = $1 and idem_key = $2 and request_hash = $3 and status = $7`,
        [memberId, key, requestHash, 'done', statusCode, body, 'pending'],
      );
    },

    async releaseIdempotencyKey(memberId, key, requestHash) {
      await db.query(
        `delete from idempotency_keys
         where member_id = $1 and idem_key = $2 and request_hash = $3 and status = $4`,
        [memberId, key, requestHash, 'pending'],
      );
    },
  };

  return api;
}
