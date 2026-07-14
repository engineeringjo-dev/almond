import { randomUUID } from 'node:crypto';
import { conflict, notFound } from '../http-error';
import { toFils } from '../money';
import type { Backend, Member, HistoryEntry, NewOrder, OrderRecord } from './types';

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
    async getHistory(id) { must(id); return history.get(id) ?? []; },
  };
}
