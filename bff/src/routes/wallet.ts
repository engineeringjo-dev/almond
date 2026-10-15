import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { idempotency } from '../plugins/idempotency';
import { toFils, toJod } from '../money';
import { forbidden } from '../http-error';
import { unfundedValueAllowed } from '../plugins/funding';
import type { Backend } from '../backend';

export function registerWalletRoutes(app: FastifyInstance, backend: Backend): void {
  const idem = idempotency(backend);
  app.post('/v1/wallet/topup', {
    preHandler: [requireMember, idem.preHandler],
    onSend: [idem.onSend],
  }, async (req, reply) => {
    const id = memberId(req);
    // 🔴 THIS ROUTE HAS NO PAYMENT BEHIND IT. `amount` is the client's word and
    // nothing here captures a card — so outside dev/test it is refused, not
    // credited. See plugins/funding.ts. `finite()` because JSON.parse('1e400')
    // is Infinity, and an Infinity lot is a wallet no debit can empty.
    if (!unfundedValueAllowed()) {
      throw forbidden('payment_capture_required', 'wallet top-up needs a captured payment; none is wired');
    }
    const { amount } = parse(z.object({ amount: z.number().positive().finite() }), req.body);
    // A top-up is money and nothing else: no points. Owner, 2026-10-15: «لا
    // يوجد بونص شحن، البونص للانفاق فقط» — the wallet's reward is
    // WALLET_EARN_MULTIPLIER, paid when the balance is SPENT (checkout). The
    // reload bonus this route used to grant is deleted from the config.
    const after = await backend.topUpWallet(id, toFils(amount));
    return reply.code(201).send({
      walletBalance: toJod(after.walletBalanceFils),
      pointsBalance: after.pointsBalance,
    });
  });
}
