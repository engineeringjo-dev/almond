import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config as loyalty } from '@almond/shared/config';
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
    const pointsBalance = await backend.spendPoints(id, points, 'استبدال نقاط', 'Points redeemed');
    return reply.code(201).send({
      redeemed: true, pointsBalance, valueJod: points / loyalty.POINTS_PER_JOD_REDEEM,
    });
  });
}
