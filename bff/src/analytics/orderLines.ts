import { calendarFeatures, type CalendarFeatures } from '@almond/shared/lib/calendar';
import { toAmmanISO } from '@almond/shared/lib/format';
import type { CartItem, OrderType } from '@almond/shared/types';

/**
 * Order-line event log — the training data for demand forecasting
 * (docs/DEMAND-FORECASTING.md §"مخطط البيانات"). Every sold line is recorded
 * with its calendar covariates so a model can be fit later.
 *
 * Timestamps are stored as UTC and mirrored in explicit Amman local time; the
 * calendar features are derived in Asia/Amman.
 *
 * NOTE: `stockoutFlag` matters as much as the sale itself — without it models
 * learn censored (understated) demand. It is recorded per item via
 * `recordStockout` when a customer hits an out-of-stock item.
 */
export interface OrderLineEvent {
  eventTimeUtc: string;
  eventTimeAmman: string;
  orderId: string;
  memberId: string;
  branchId: string;
  channel: 'app' | 'web' | 'cashier' | 'delivery';
  orderType: OrderType;
  itemId: string;
  categoryId?: string;
  sizeId: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  activePromoId?: string;
  stockoutFlag: boolean;
  calendar: CalendarFeatures;
}

const events: OrderLineEvent[] = [];
const MAX_EVENTS = 200_000; // in-memory ring; ship to a warehouse in production

export function recordOrderLines(input: {
  orderId: string;
  memberId: string;
  branchId: string;
  channel?: OrderLineEvent['channel'];
  orderType: OrderType;
  items: CartItem[];
  activePromoId?: string;
  at?: Date;
}): void {
  const at = input.at ?? new Date();
  const cal = calendarFeatures(at);
  const utc = at.toISOString();
  const amman = toAmmanISO(at);
  for (const l of input.items) {
    const unitPrice = l.unitBasePrice + l.customizations.reduce((s, c) => s + c.priceDelta, 0);
    events.push({
      eventTimeUtc: utc,
      eventTimeAmman: amman,
      orderId: input.orderId,
      memberId: input.memberId,
      branchId: input.branchId,
      channel: input.channel ?? 'app',
      orderType: input.orderType,
      itemId: l.itemId,
      sizeId: l.sizeId,
      qty: l.qty,
      unitPrice,
      lineTotal: unitPrice * l.qty,
      activePromoId: input.activePromoId,
      stockoutFlag: false,
      calendar: cal,
    });
  }
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

/** Demand that could NOT be served — required to correct censored demand. */
export function recordStockout(branchId: string, itemId: string, at: Date = new Date()): void {
  const cal = calendarFeatures(at);
  events.push({
    eventTimeUtc: at.toISOString(),
    eventTimeAmman: toAmmanISO(at),
    orderId: '', memberId: '', branchId, channel: 'app', orderType: 'pickup',
    itemId, sizeId: '', qty: 0, unitPrice: 0, lineTotal: 0,
    stockoutFlag: true, calendar: cal,
  });
}

export function listOrderLines(filter?: { branchId?: string; since?: string; limit?: number }): OrderLineEvent[] {
  let out = events;
  if (filter?.branchId) out = out.filter((e) => e.branchId === filter.branchId);
  if (filter?.since) out = out.filter((e) => e.eventTimeUtc >= filter.since!);
  const limit = filter?.limit ?? 5000;
  return out.slice(-limit);
}

/** History for one (branch × item × dow × daypart) — feeds seasonalNaive(). */
export function historyFor(branchId: string, itemId: string, dow: number, daypart: string): number[] {
  const byDay = new Map<string, number>();
  for (const e of events) {
    if (e.stockoutFlag) continue;
    if (e.branchId !== branchId || e.itemId !== itemId) continue;
    if (e.calendar.dow !== dow || e.calendar.daypart !== daypart) continue;
    const day = e.eventTimeAmman.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + e.qty);
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, q]) => q);
}

export function clearOrderLines(): void { events.length = 0; }
