import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { idempotencyPreHandler, idempotencyOnSend } from '../plugins/idempotency';
import { reprice } from '../pricing';
import { computeEarn } from '../earn';
import { toFils, toJod } from '../money';
import { recordOrderLines } from '../analytics/orderLines';
import type { Backend } from '../backend';

const bodySchema = z.object({
  branchId: z.string(),
  orderType: z.enum(['pickup', 'dinein', 'delivery']),
  paymentMethod: z.enum(['cash', 'cliq', 'visa', 'mastercard', 'paypal', 'wallet']),
  lines: z.array(z.object({
    itemId: z.string(),
    sizeId: z.enum(['S', 'M', 'L']),
    optionIds: z.array(z.string()).default([]),
    qty: z.number().int().positive(),
  })).min(1),
});

export function registerCheckoutRoutes(app: FastifyInstance, backend: Backend): void {
  app.post('/v1/checkout', {
    preHandler: [requireMember, idempotencyPreHandler],
    onSend: [idempotencyOnSend],
  }, async (req, reply) => {
    const id = memberId(req);
    const input = parse(bodySchema, req.body);
    const member = await backend.getMember(id);

    // 1) Authoritative re-price from the menu (ignore any client totals).
    const { items, totals, comboBonus } = reprice(input.lines);
    const paidFromBalance = input.paymentMethod === 'wallet';

    // 2) Atomic saga with compensation.
    let walletDebited = 0;
    try {
      if (paidFromBalance) {
        walletDebited = toFils(totals.total);
        await backend.debitWallet(id, walletDebited); // throws → nothing else runs
      }
      // NOTE: card/cliq payments would capture via a PSP here (out of scope).
      const order = await backend.createOrder({
        memberId: id, branchId: input.branchId, type: input.orderType,
        paymentMethod: input.paymentMethod,
        subtotal: totals.subtotal, tax: totals.tax, total: totals.total, pointsEarned: 0,
      });
      // Log the sold lines with calendar covariates (forecasting training data).
      recordOrderLines({
        orderId: order.id, memberId: id, branchId: input.branchId,
        orderType: input.orderType, items,
      });

      const pointsEarned = computeEarn({
        total: totals.total, windowSpend: member.windowSpend, paidFromBalance, comboBonus,
      });
      const pointsBalance = await backend.addPoints(id, pointsEarned, 'نقاط طلب', 'Order points');
      await backend.addSpend(id, totals.total);
      const after = await backend.getMember(id);
      return reply.code(201).send({
        orderId: order.id,
        subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
        itemCount: items.reduce((s, l) => s + l.qty, 0),
        pointsEarned, pointsBalance, walletBalance: toJod(after.walletFils),
      });
    } catch (err) {
      if (walletDebited > 0) {
        try { await backend.creditWallet(id, walletDebited); } catch { /* compensation best-effort */ }
      }
      throw err;
    }
  });
}
