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

function reloadBonus(amount: number): number {
  const tiers = [...loyalty.WALLET_RELOAD_BONUS].sort((a, b) => b.minJOD - a.minJOD);
  return tiers.find((t) => amount >= t.minJOD)?.bonusBeans ?? 0;
}

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
    const bonus = reloadBonus(amount);
    // ONE transaction: the top-up lot and its reload-bonus lot land together.
    // Two calls used to leave a member credited without the bonus they were
    // shown if the process died between them.
    const after = await backend.topUpWallet(id, toFils(amount), bonus, 'مكافأة شحن المحفظة', 'Wallet reload bonus');
    return reply.code(201).send({
      walletBalance: toJod(after.walletBalanceFils),
      bonusPoints: bonus,
      pointsBalance: after.pointsBalance,
    });
  });
}
