import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config as loyalty } from '@almond/shared/config';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { idempotencyPreHandler, idempotencyOnSend } from '../plugins/idempotency';
import { toFils, toJod } from '../money';
import type { Backend } from '../backend';

function reloadBonus(amount: number): number {
  const tiers = [...loyalty.WALLET_RELOAD_BONUS].sort((a, b) => b.minJOD - a.minJOD);
  return tiers.find((t) => amount >= t.minJOD)?.bonusBeans ?? 0;
}

export function registerWalletRoutes(app: FastifyInstance, backend: Backend): void {
  app.post('/v1/wallet/topup', {
    preHandler: [requireMember, idempotencyPreHandler],
    onSend: [idempotencyOnSend],
  }, async (req, reply) => {
    const id = memberId(req);
    const { amount } = parse(z.object({ amount: z.number().positive() }), req.body);
    await backend.creditWallet(id, toFils(amount));
    const bonus = reloadBonus(amount);
    if (bonus > 0) await backend.addPoints(id, bonus, 'مكافأة شحن المحفظة', 'Wallet reload bonus');
    const after = await backend.getMember(id);
    // The reload bonus is a lot of its own, with its own 12-month clock: a
    // top-up grants points, it does not renew the ones already held. (The app's
    // mock used to carry `u.lastEarnAt = Date.now(); // a reload counts as
    // activity (extends beans)` — that line WAS the inactivity rule, and it is
    // gone along with the rule.)
    return reply.code(201).send({
      walletBalance: toJod(after.walletFils),
      bonusPoints: bonus,
      pointsBalance: liveBalance(after.lots),
    });
  });
}
