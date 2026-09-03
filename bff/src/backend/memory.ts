import { randomUUID } from 'node:crypto';
import { config as loyalty } from '@almond/shared/config';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import { conflict, notFound } from '../http-error';
import { toFils } from '../money';
import type { Backend, Member, HistoryEntry, NewOrder, OrderRecord, SubscriptionState } from './types';

/** One business day for the whole system (§3.6) — Amman, not the host's UTC.
 *  This is the §5 step 1 repoint. It moves the daily free-drink counter's reset
 *  from 03:00 Amman (the UTC rollover) to 00:00 Amman. That is the day
 *  BOUNDARY, not the cap: `drinksPerDay` is untouched, and the cap's VALUE is
 *  the product decision held in §8.5 (D7). */
const todayKey = (): string => ammanDayKey();

/** In-memory, runnable adapter. State lives in process memory (fine for dev /
 *  demo / tests); swap for the Odoo adapter in production. */
export function createMemoryBackend(): Backend {
  const members = new Map<string, Member>();
  const byPhone = new Map<string, string>();
  const history = new Map<string, HistoryEntry[]>();
  const orders: OrderRecord[] = [];

  // Seed a demo member so a freshly-issued token has data.
  const demo: Member = {
    id: 'demo', phone: '+962790000000', name: 'Almond Member',
    points: 240, walletFils: toFils(20), windowSpend: 120, lastEarnAt: Date.now(),
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

  return {
    async findOrCreateByPhone(phone, name) {
      const existing = byPhone.get(phone);
      if (existing) return members.get(existing)!;
      const m: Member = {
        id: `m_${randomUUID()}`, phone, name: name ?? 'Member',
        points: 0, walletFils: 0, windowSpend: 0, lastEarnAt: Date.now(),
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
    async addSpend(id, jod) { const m = must(id); m.windowSpend += jod; m.lastEarnAt = Date.now(); },
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
