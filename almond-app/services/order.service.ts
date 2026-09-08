import type { CartItem, Order, OrderStatus } from '@/types';
import { menuItems } from '@almond/shared/menu';
import { itemKind } from '@almond/shared/lib/categoryKind';
import { config } from '@/constants/config';
import { toAmmanISO } from '@/lib/format';
import { delay, genId } from './util';

export interface CreateOrderInput {
  userId: string;
  type: Order['type'];
  branchId: string;
  branchNameAr: string;
  branchNameEn: string;
  items: Order['items'];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: Order['paymentMethod'];
  paidFromBalance: boolean;
  prepMinutes: number;
  /** Travel time estimate in minutes (smart pickup, section 7.3). */
  travelMinutes: number;
  promoCode?: string;
  curbside?: boolean;
  carInfo?: string;
}

export interface OrderService {
  createOrder(input: CreateOrderInput): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getActiveOrders(userId: string): Promise<Order[]>;
  getHistory(userId: string): Promise<Order[]>;
  /** Advance the status (mock simulation of the KDS). */
  advanceStatus(id: string): Promise<Order | undefined>;
  /** Cancel within the 30s grace window (Master Pack Part 3). */
  cancelOrder(id: string): Promise<Order | undefined>;
}

/** Seconds after placing during which an order can be cancelled/modified. */
export const CANCEL_WINDOW_SECONDS = 30;

const STATUS_FLOW: OrderStatus[] = ['received', 'preparing', 'ready', 'completed'];

// In-memory order store for the mock (resets on reload).
const orders = new Map<string, Order>();

/**
 * Two real menu rows for the seeded history.
 *
 * 🔴 THE IDS MUST EXIST IN THE MENU, NOT JUST LOOK LIKE FOOD. This seed used to
 * hardcode `itemId: 'latte'` and `'butter-croissant'` — Talabat ids. The Odoo
 * pull renumbered every item to `p-<odooId>`, and because "Reorder" copies these
 * stored lines straight into the cart (app/profile/orders.tsx), a member
 * reordering their demo history would have built a basket of items the server
 * has never heard of and been refused at checkout. The card would have rendered
 * perfectly on the way there: the line carries its own name and price, so
 * nothing looks wrong until the 400.
 *
 * Derived by the same classifier the rest of the app uses, so this cannot rot
 * against the next menu source either.
 */
const SEED_DRINK = menuItems.find(
  (m) => itemKind(m.id) === 'drink' && m.sizes[0]?.price > 0,
)!;
const SEED_FOOD = menuItems.find(
  (m) => itemKind(m.id) === 'food' && m.sizes[0]?.price > 0,
)!;

const seedLine = (item: typeof SEED_DRINK, isDrink: boolean): CartItem => ({
  lineId: `${item.id}__${item.sizes[0].id}__`,
  itemId: item.id,
  nameAr: item.nameAr, nameEn: item.nameEn, emoji: item.emoji,
  sizeId: item.sizes[0].id,
  sizeNameAr: item.sizes[0].nameAr, sizeNameEn: item.sizes[0].nameEn,
  unitBasePrice: item.sizes[0].price, customizations: [], qty: 1, isDrink,
});

function seedHistory(userId: string) {
  if ([...orders.values()].some((o) => o.userId === userId)) return;
  // Seed a couple of past orders so "My Usual" and history work (section 7.2).
  const now = Date.now();
  const drink = seedLine(SEED_DRINK, true);
  const food = seedLine(SEED_FOOD, false);
  // Totals follow the seeded lines rather than restating them, so the history
  // cannot claim a price the basket does not add up to.
  const t = (lines: CartItem[]) => {
    const subtotal = lines.reduce((sum, l) => sum + l.unitBasePrice * l.qty, 0);
    const tax = Math.round(subtotal * config.TAX_RATE * 1000) / 1000;
    return { subtotal, tax, discount: 0, total: Math.round((subtotal + tax) * 1000) / 1000 };
  };
  const past: Order[] = [
    {
      id: genId('order'), userId, type: 'pickup', branchId: 'khalda',
      branchNameAr: 'الخالدة', branchNameEn: 'Khalda',
      items: [drink],
      ...t([drink]), paymentMethod: 'cash',
      paidFromBalance: false, status: 'completed', createdAt: new Date(now - 86400000 * 3).toISOString(),
      targetReadyAt: new Date(now - 86400000 * 3 + 420000).toISOString(), prepMinutes: 7,
    },
    {
      id: genId('order'), userId, type: 'pickup', branchId: 'khalda',
      branchNameAr: 'الخالدة', branchNameEn: 'Khalda',
      items: [drink, food],
      ...t([drink, food]), paymentMethod: 'wallet',
      paidFromBalance: true, status: 'completed', createdAt: new Date(now - 86400000 * 7).toISOString(),
      targetReadyAt: new Date(now - 86400000 * 7 + 420000).toISOString(), prepMinutes: 7,
    },
  ];
  past.forEach((o) => orders.set(o.id, o));
}

const mockOrderService: OrderService = {
  createOrder: (input) => {
    const now = new Date();
    // KDS times order to arrival: ready at max(prep, travel) from now (section 7.3).
    const leadMinutes = Math.max(input.prepMinutes, input.travelMinutes);
    const order: Order = {
      id: genId('order'),
      userId: input.userId,
      type: input.type,
      branchId: input.branchId,
      branchNameAr: input.branchNameAr,
      branchNameEn: input.branchNameEn,
      items: input.items,
      subtotal: input.subtotal,
      tax: input.tax,
      discount: input.discount,
      total: input.total,
      paymentMethod: input.paymentMethod,
      paidFromBalance: input.paidFromBalance,
      status: 'received',
      createdAt: toAmmanISO(now),
      targetReadyAt: toAmmanISO(now.getTime() + leadMinutes * 60000),
      prepMinutes: input.prepMinutes,
      promoCode: input.promoCode,
      curbside: input.curbside,
      carInfo: input.carInfo,
    };
    orders.set(order.id, order);
    return delay(order);
  },

  getOrder: (id) => delay(orders.get(id)),

  getActiveOrders: (userId) => {
    seedHistory(userId);
    return delay(
      [...orders.values()]
        .filter(
          (o) => o.userId === userId && o.status !== 'completed' && o.status !== 'cancelled',
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  },

  getHistory: (userId) => {
    seedHistory(userId);
    return delay(
      [...orders.values()]
        .filter((o) => o.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  },

  advanceStatus: (id) => {
    const order = orders.get(id);
    if (!order) return delay(undefined);
    if (order.status === 'cancelled') return delay(order); // never advance a cancelled order
    // Hold during the cancel/modify grace window — KDS starts after it (Part 3).
    const age = (Date.now() - new Date(order.createdAt).getTime()) / 1000;
    if (order.status === 'received' && age < CANCEL_WINDOW_SECONDS) return delay(order, 200);
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < STATUS_FLOW.length - 1) {
      order.status = STATUS_FLOW[idx + 1];
      orders.set(id, order);
    }
    return delay(order, 200);
  },

  cancelOrder: (id) => {
    const order = orders.get(id);
    if (!order) return delay(undefined);
    const age = (Date.now() - new Date(order.createdAt).getTime()) / 1000;
    // Only cancellable inside the grace window and before prep starts.
    if (order.status === 'received' && age <= CANCEL_WINDOW_SECONDS) {
      order.status = 'cancelled';
      orders.set(id, order);
    }
    return delay(order, 150);
  },
};

const odooOrderService: OrderService = {
  // TODO: confirm Odoo endpoint — app order → Odoo sale order; status sync back (section 6.3).
  createOrder: mockOrderService.createOrder,
  getOrder: mockOrderService.getOrder,
  getActiveOrders: mockOrderService.getActiveOrders,
  getHistory: mockOrderService.getHistory,
  advanceStatus: mockOrderService.advanceStatus,
  cancelOrder: mockOrderService.cancelOrder,
};

export const orderService: OrderService =
  config.DATA_SOURCE === 'odoo' ? odooOrderService : mockOrderService;
