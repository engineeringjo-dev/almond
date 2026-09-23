import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config as loyalty } from '@almond/shared/config';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { idempotencyPreHandler, idempotencyOnSend } from '../plugins/idempotency';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { toFils, toJod } from '../money';
import { forbidden } from '../http-error';
import { unfundedValueAllowed } from '../plugins/funding';
import type { Backend } from '../backend';

/** "Almond Club" monthly subscription (server-authoritative). Charge is atomic
 *  when paying from the wallet, and idempotent so a retry never double-bills. */
export function registerSubscriptionRoutes(app: FastifyInstance, backend: Backend): void {
  app.post('/v1/subscription/subscribe', {
    preHandler: [requireMember, idempotencyPreHandler],
    onSend: [idempotencyOnSend],
  }, async (req, reply) => {
    const id = memberId(req);
    const { paymentMethod } = parse(
      z.object({ paymentMethod: z.enum(['cash', 'cliq', 'visa', 'mastercard', 'paypal', 'wallet']) }),
      req.body,
    );
    // A month of daily free drinks for `paymentMethod: "cash"` is value created
    // against a payment nobody took. Only the wallet is funded server-side.
    if (paymentMethod !== 'wallet' && !unfundedValueAllowed()) {
      throw forbidden('payment_capture_required', 'only a wallet payment can be captured today');
    }
    const priceFils = toFils(loyalty.SUBSCRIPTION.priceJod);
    let debited = 0;
    try {
      if (paymentMethod === 'wallet') {
        // 🔴 ASSIGNED AFTER THE AWAIT — the checkout.ts T34f defect, which lived
        // on here. `debited` was set on the line BEFORE the debit, so when the
        // debit threw `insufficient_wallet` the catch below "refunded" 18 JOD
        // that had never left the wallet. An empty wallet POSTing this with a
        // fresh Idempotency-Key minted 18 JOD per request, and the second
        // request then paid for the subscription with the first one's money.
        await backend.debitWallet(id, priceFils);
        debited = priceFils;
      }
      // else: card/CliQ capture via a PSP would go here.
      const subscription = await backend.activateSubscription(id);
      const after = await backend.getMember(id);
      return reply.code(201).send({ subscription, walletBalance: toJod(liveBalance(after.walletLots)), priceJod: loyalty.SUBSCRIPTION.priceJod });
    } catch (err) {
      if (debited > 0) { try { await backend.creditWallet(id, debited, 'refund'); } catch { /* compensate */ } }
      throw err;
    }
  });

  app.post('/v1/subscription/redeem', {
    preHandler: [requireMember, idempotencyPreHandler],
    onSend: [idempotencyOnSend],
  }, async (req, reply) => {
    const subscription = await backend.redeemSubscriptionDrink(memberId(req));
    return reply.code(201).send({ redeemed: true, subscription });
  });

  app.get('/v1/me/subscription', { preHandler: [requireMember] }, async (req) => {
    return backend.getSubscription(memberId(req));
  });
}
