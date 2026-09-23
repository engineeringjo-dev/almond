import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config as loyalty } from '@almond/shared/config';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { idempotency } from '../plugins/idempotency';
import { toFils, toJod } from '../money';
import { forbidden } from '../http-error';
import { unfundedValueAllowed } from '../plugins/funding';
import type { Backend } from '../backend';

/** "Almond Club" monthly subscription (server-authoritative). Charge is atomic
 *  when paying from the wallet, and idempotent so a retry never double-bills. */
export function registerSubscriptionRoutes(app: FastifyInstance, backend: Backend): void {
  const idem = idempotency(backend);
  app.post('/v1/subscription/subscribe', {
    preHandler: [requireMember, idem.preHandler],
    onSend: [idem.onSend],
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
    // ONE transaction: the debit and the activation commit together or not at
    // all (Backend.purchaseSubscription). This used to be a debit, then an
    // activation, with a compensating refund in a catch — which a process that
    // died between the two never reached, so the member paid 18 JOD for no
    // subscription. It also carried the T34f defect: `debited` set before the
    // debit, so a refused debit was "refunded" — 18 JOD minted per request.
    // With nothing to compensate, neither shape can come back.
    // (card/CliQ capture via a PSP would go here; it debits nothing today.)
    const { subscription, walletBalanceFils } = await backend.purchaseSubscription(
      id, paymentMethod === 'wallet' ? priceFils : 0,
    );
    return reply.code(201).send({ subscription, walletBalance: toJod(walletBalanceFils), priceJod: loyalty.SUBSCRIPTION.priceJod });
  });

  app.post('/v1/subscription/redeem', {
    preHandler: [requireMember, idem.preHandler],
    onSend: [idem.onSend],
  }, async (req, reply) => {
    const subscription = await backend.redeemSubscriptionDrink(memberId(req));
    return reply.code(201).send({ redeemed: true, subscription });
  });

  app.get('/v1/me/subscription', { preHandler: [requireMember] }, async (req) => {
    return backend.getSubscription(memberId(req));
  });
}
