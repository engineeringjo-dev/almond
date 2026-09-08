import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { jodFromPoints } from '@almond/shared/loyalty/earn';
import { toSecondVisitView } from '@almond/shared/loyalty/secondVisit';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { idempotencyPreHandler, idempotencyOnSend } from '../plugins/idempotency';
import type { Backend } from '../backend';

export function registerLoyaltyRoutes(app: FastifyInstance, backend: Backend): void {
  app.post('/v1/loyalty/redeem', {
    preHandler: [requireMember, idempotencyPreHandler],
    onSend: [idempotencyOnSend],
  }, async (req, reply) => {
    const id = memberId(req);
    const { points } = parse(z.object({ points: z.number().int().positive() }), req.body);
    // NO MINIMUM. Owner, 2026-09-08: points are money and a member may take any
    // number of them off their bill — «فهي تقلل الفاتورة او تعملها مجانية».
    // There is no catalogue and therefore no cheapest thing to be able to
    // afford; `positive()` is the only floor and it is arithmetic, not an offer.
    const pointsBalance = await backend.spendPoints(id, points, 'استبدال نقاط', 'Points redeemed');
    return reply.code(201).send({
      // ONE conversion, in loyalty/earn.ts. The same rate now decides what the
      // member is handed AND what comes off the invoice before the earn, so a
      // second copy of it here would pay them at one rate and charge them at
      // another.
      redeemed: true, pointsBalance, valueJod: jodFromPoints(points),
    });
  });

  // ---- The second-visit voucher ----
  //
  // Both routes live HERE and not in routes/me.ts even though the read is a
  // /v1/me/* path: registerSubscriptionRoutes already owns GET
  // /v1/me/subscription, so a feature module owning its own /v1/me read is
  // established — and routes/me.ts is where the rolling window reports, so
  // keeping the voucher out of it keeps two features out of one file.
  //
  // SINGULAR '/voucher', not '/vouchers': the storage model is one row per
  // member and a route must not promise a plurality the storage cannot hold.
  // When a second programme lands the key changes (memberId → memberId +
  // programme) and the route changes with it, as one coherent change.

  app.get('/v1/me/voucher', { preHandler: [requireMember] }, async (req) => {
    const row = await backend.getSecondVisitVoucher(memberId(req));
    // {"voucher":null} for a member with no row AND for one who was suppressed,
    // declined or ineligible — four server-side situations, one client answer.
    return { voucher: toSecondVisitView(row, new Date()) };
  });

  app.post('/v1/loyalty/voucher/redeem', {
    preHandler: [requireMember, idempotencyPreHandler],
    onSend: [idempotencyOnSend],
  }, async (req, reply) => {
    const at = new Date();
    // Redemption moves NO points and NO wallet balance. The whole economic
    // argument for this mechanic is that the item is paid IN KIND: a 1.90 JOD
    // pastry at 79% margin costs 0.399 JOD of material, so food carries 4.8×
    // leverage and a 92%-margin sweet 12.5×, against cashback's 1.0×. Paying it
    // as points would convert a 4.8× lever into a 1.0× one. The free line
    // itself is applied at the till (an Odoo loyalty.reward).
    const voucher = await backend.redeemSecondVisitVoucher(memberId(req), at);
    return reply.code(201).send({ redeemed: true, voucher: toSecondVisitView(voucher, at) });
  });
}
