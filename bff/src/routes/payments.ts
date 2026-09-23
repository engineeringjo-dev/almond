import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { config } from '../config';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { idempotency } from '../plugins/idempotency';
import { limiter, rateLimit } from '../plugins/rateLimit';
import { badRequest, notFound, serviceUnavailable, unauthorized } from '../http-error';
import { toFils, toJod } from '../money';
import { paymentProvider, UnconfiguredPaymentProvider } from '../payments';
import { cartHash, paymentIntentUsed, paymentNotCaptured, type CartIdentity } from '../payments/intent';
import { cartBodySchema, GATEWAY_METHODS, priceCartForMember } from './cart';
import type { Backend } from '../backend';
import type { CheckoutPayment } from '../backend/types';

const intents = limiter('payment-intent', () => config.RATE_LIMITS.paymentIntentPerMember);

/** A webhook body is a few KB at most; anything larger is not a gateway. */
const WEBHOOK_BODY_LIMIT = 64 * 1024;

/**
 * May this member's card order of `amountFils`, for this basket, be placed?
 *
 * Asks the PROVIDER — the only authority on whether money moved — and checks
 * what it says against what the server re-priced. Returns the payment for
 * Backend.checkout to consume inside its transaction (which re-checks owner,
 * amount, basket and "unspent" under the row lock). Throws 402
 * `payment_not_captured`, 409 `payment_intent_used`, or the provider's 503.
 */
export async function confirmCardPayment(
  backend: Backend,
  member: string,
  intentId: string | undefined,
  order: { amountFils: number; cart: CartIdentity },
): Promise<CheckoutPayment> {
  if (!intentId) throw paymentNotCaptured('a card order needs paymentIntentId from POST /v1/payments/intent');
  const intent = await backend.getPaymentIntent(intentId);
  if (!intent || intent.memberId !== member) throw paymentNotCaptured('no such payment for this member');
  if (intent.orderId !== null) throw paymentIntentUsed();
  if (intent.cartHash !== cartHash(order.cart)) throw paymentNotCaptured('the payment was for a different basket');
  if (intent.amountFils !== order.amountFils) throw paymentNotCaptured('the payment was for a different amount');
  const provider = paymentProvider();
  // A payment is only ever confirmed by the gateway that took it. After a
  // provider switch, an old intent is not "probably fine".
  if (provider.name !== intent.provider) throw paymentNotCaptured('the payment was taken by a provider that is not active');
  const capture = await provider.getCapture(intent.providerRef);
  if (capture.status !== 'captured') throw paymentNotCaptured(`the gateway reports it ${capture.status}`);
  // EXACT, in integer fils: a partial capture funds nothing.
  if (!Number.isInteger(capture.amountFils) || capture.amountFils !== intent.amountFils) {
    throw paymentNotCaptured('the captured amount does not match the order total');
  }
  return {
    intentId: intent.id, amountFils: intent.amountFils, cartHash: intent.cartHash,
    captureRef: capture.captureRef ?? null,
  };
}

export async function registerPaymentRoutes(app: FastifyInstance, backend: Backend): Promise<void> {
  const idem = idempotency(backend);

  /**
   * START A CARD PAYMENT for a basket. The body is the SAME cart /v1/checkout
   * takes; the server re-prices it (menu + standing corporate discount) and the
   * gateway is asked for exactly that. The member then pays on the gateway's
   * page / SDK and calls /v1/checkout with `paymentIntentId`.
   */
  app.post('/v1/payments/intent', {
    preHandler: [requireMember, rateLimit(intents, memberId), idem.preHandler],
    onSend: [idem.onSend],
  }, async (req, reply) => {
    const id = memberId(req);
    const input = parse(cartBodySchema, req.body);
    if (!GATEWAY_METHODS.has(input.paymentMethod)) {
      throw badRequest(`"${input.paymentMethod}" is not paid through the card gateway — use /v1/checkout directly`);
    }
    const { totals } = await priceCartForMember(backend, id, input.lines);
    const amountFils = toFils(totals.total);
    if (amountFils <= 0) throw badRequest('nothing to pay for');
    const provider = paymentProvider();
    const intentId = `pi_${randomUUID()}`;
    // The gateway is asked FIRST: an unconfigured provider answers 503 having
    // written nothing, and a gateway that refuses leaves no dangling row. If
    // the insert below fails, the gateway holds an intent nobody was shown a
    // payment page for — it can never be captured.
    const created = await provider.createIntent({
      intentId, amountFils, currency: 'JOD', memberId: id,
      description: `Almond order (${input.branchId})`,
      ...(config.PAYMENT_RETURN_URL ? { returnUrl: config.PAYMENT_RETURN_URL } : {}),
    });
    await backend.createPaymentIntent({
      id: intentId, memberId: id, amountFils, currency: 'JOD',
      cartHash: cartHash({ branchId: input.branchId, orderType: input.orderType, lines: input.lines }),
      provider: provider.name, providerRef: created.providerRef,
    }, new Date());
    return reply.code(201).send({
      intentId,
      amountJod: toJod(amountFils),
      ...(created.redirectUrl ? { redirectUrl: created.redirectUrl } : {}),
      ...(created.clientSecret ? { clientSecret: created.clientSecret } : {}),
    });
  });

  /**
   * THE GATEWAY'S WEBHOOK. No member, no POS key: the credential is the
   * provider's signature over the RAW body, which is why this route lives in
   * its own scope with a string body parser — a re-serialised JSON body does
   * not hash the same as the bytes the gateway signed.
   *
   * It records the status; it never places an order and never grants a point.
   * /v1/checkout still asks the gateway itself (confirmCardPayment).
   */
  await app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser('*', { parseAs: 'string', bodyLimit: WEBHOOK_BODY_LIMIT },
      (_req, body, done) => done(null, body));
    scope.post('/v1/payments/webhook/:provider', async (req, reply) => {
      const { provider: named } = parse(z.object({ provider: z.string().max(64) }), req.params);
      const provider = paymentProvider();
      if (provider instanceof UnconfiguredPaymentProvider) {
        throw serviceUnavailable('payment_provider_unconfigured', 'card payment is not available on this server (PAYMENT_PROVIDER is not set)');
      }
      if (named !== provider.name) throw notFound('no such payment provider');
      const raw = typeof req.body === 'string' ? req.body : '';
      const headers: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) headers[k] = Array.isArray(v) ? v.join(',') : v;
      const event = provider.verifyWebhook(raw, headers);
      if (!event) throw unauthorized('invalid webhook signature');
      const intent = await backend.recordPaymentStatus(provider.name, event.providerRef, event.status, new Date());
      if (!intent) req.log.warn({ provider: provider.name, providerRef: event.providerRef }, 'payment webhook for an unknown intent');
      // 200 either way once the signature holds: a gateway retries anything
      // else for days, and an unknown reference will not become known.
      return reply.code(200).send({ received: true, intentId: intent?.id ?? null });
    });
  });
}
