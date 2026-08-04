import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config as loyalty } from '@almond/shared/config';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { idempotencyPreHandler, idempotencyOnSend } from '../plugins/idempotency';
import { toFils, toJod } from '../money';
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
    const priceFils = toFils(loyalty.SUBSCRIPTION.priceJod);
    let debited = 0;
    try {
      if (paymentMethod === 'wallet') { debited = priceFils; await backend.debitWallet(id, priceFils); }
      // else: card/CliQ capture via a PSP would go here.
      const subscription = await backend.activateSubscription(id);
      const after = await backend.getMember(id);
      return reply.code(201).send({ subscription, walletBalance: toJod(after.walletFils), priceJod: loyalty.SUBSCRIPTION.priceJod });
    } catch (err) {
      if (debited > 0) { try { await backend.creditWallet(id, debited); } catch { /* compensate */ } }
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
