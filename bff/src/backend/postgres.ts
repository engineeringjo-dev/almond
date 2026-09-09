import { randomInt, randomUUID } from 'node:crypto';
import { config as loyalty } from '@almond/shared/config';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import {
  consumeFifo, expiredBetween, grantLot, liveBalance, lotRulesFromConfig,
  pruneLots, walletLotRulesFromConfig,
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
import type {
  Backend, Member, HistoryEntry, NewOrder, OrderRecord, SubscriptionState, CorporateUse,
} from './types';

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
  sub_renews_at: string | number; sub_day: string; sub_day_count: number;
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
    subRenewsAt: Number(r.sub_renews_at ?? 0),
    subDay: r.sub_day, subDayCount: r.sub_day_count,
  };
}

export function createPostgresBackend(db: Db): Backend {
  /** Load a member, mutate it with the shared rules, write it back — all inside
   *  one transaction holding `FOR UPDATE` on the row, so two concurrent
   *  checkouts cannot both read the same balance and both spend it. */
  async function withMember<T>(
    id: string,
    fn: (m: Member, log: (e: HistoryEntry) => void, t: Db) => Promise<T> | T,
  ): Promise<T> {
    return db.tx(async (t) => {
      const rows = await t.query<MemberRow>('select * from members where id = $1 for update', [id]);
      if (!rows[0]) throw notFound('member not found');
      const m = toMember(rows[0]);
      const lines: HistoryEntry[] = [];
      const out = await fn(m, (e) => lines.push(e), t);
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
         spend=$9, held_tier_id=$10, evaluated_through=$11,
         sub_renews_at=$12, sub_day=$13, sub_day_count=$14
       where id=$1`,
      [
        m.id, m.name, m.birthday, m.profileBonusAt, JSON.stringify(m.lots),
        m.expirySettledThrough, JSON.stringify(m.walletLots), m.walletExpirySettledThrough,
        JSON.stringify(m.spend), m.heldTierId, m.evaluatedThrough,
        m.subRenewsAt, m.subDay, m.subDayCount,
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
          subRenewsAt: 0, subDay: '', subDayCount: 0,
        };
        await t.query(
          `insert into members (id, phone, name, birthday, profile_bonus_at, lots,
             expiry_settled_through, wallet_lots, wallet_expiry_settled_through, spend,
             held_tier_id, evaluated_through, sub_renews_at, sub_day, sub_day_count)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [m.id, m.phone, m.name, m.birthday, m.profileBonusAt, JSON.stringify(m.lots),
            m.expirySettledThrough, JSON.stringify(m.walletLots), m.walletExpirySettledThrough,
            JSON.stringify(m.spend), m.heldTierId, m.evaluatedThrough,
            m.subRenewsAt, m.subDay, m.subDayCount],
        );
        return m;
      });
    },

    async getMember(id) {
      const rows = await db.query<MemberRow>('select * from members where id = $1', [id]);
      if (!rows[0]) throw notFound('member not found');
      return toMember(rows[0]);
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
      await withMember(id, (m, log) => {
        const at = new Date();
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
      });
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
          'select * from members where id = $1 for update', [input.memberId],
        );
        if (!rows[0]) throw notFound('member not found');
        const m = toMember(rows[0]);
        const existing = await t.query(
          'select * from second_visit_vouchers where member_id = $1', [input.memberId],
        );
        if (existing[0]) return null;      // once per member, ever

        // Every input computed exactly as the memory backend computes it — the
        // 19,040 JOD over-issue guard rests on `unexplainedPoints` being the
        // balance MINUS what this BFF itself granted, so the sum is over the
        // whole ledger (both signs), not just the debits.
        const ledger = await t.query<{ n: string }>(
          'select coalesce(sum(delta_points),0)::text as n from point_history where member_id = $1',
          [input.memberId],
        );
        const prior = await t.query<{ n: string }>(
          'select count(*)::text as n from orders where member_id = $1 and id <> $2',
          [input.memberId, input.orderId],
        );
        const decision = decideSecondVisit({
          memberId: input.memberId,
          orderId: input.orderId,
          voucherId: `svv_${randomUUID()}`,
          basketHasDrink: input.basketHasDrink,
          arm: input.arm,
          alreadyEvaluated: false,          // checked above: a row means never again
          priorTransactions: Number(prior[0]?.n ?? 0),
          unexplainedPoints: liveBalance(m.lots, input.at) - Number(ledger[0]?.n ?? 0),
          priorWindowSpend: qualifyingSpend(m.spend, WINDOW, input.at),
          at: input.at,
        });

        const row = decision.row;
        if (!row) return null;
        await t.query(
          `insert into second_visit_vouchers (member_id, outcome, arm, issued_at, expires_at, redeemed_at)
           values ($1,$2,$3,$4,$5,$6)`,
          [input.memberId, row.outcome, input.arm, row.issuedAt, row.expiresAt, row.redeemedAt],
        );
        return row.outcome === 'issued' ? row : null;
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

    // ---- subscription ----
    async activateSubscription(id) {
      return withMember(id, (m) => {
        m.subRenewsAt = Date.now() + loyalty.SUBSCRIPTION.periodDays * 86400000;
        return subState(m);
      });
    },

    async redeemSubscriptionDrink(id) {
      return withMember(id, (m) => {
        if (m.subRenewsAt <= Date.now()) throw conflict('not_subscribed', 'No active subscription');
        const today = todayKey();
        if (m.subDay !== today) { m.subDay = today; m.subDayCount = 0; }
        if (m.subDayCount >= loyalty.SUBSCRIPTION.drinksPerDay) {
          throw conflict('daily_cap', "Today's free drinks are used up");
        }
        m.subDayCount += 1;
        return subState(m);
      });
    },

    async getSubscription(id) { return subState(await api.getMember(id)); },
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

  return api;
}
