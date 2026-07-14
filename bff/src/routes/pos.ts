import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { issuePosToken, verifyPosToken } from '../pos/token';
import { unauthorized } from '../http-error';
import type { Backend } from '../backend';

export function registerPosRoutes(app: FastifyInstance, _backend: Backend): void {
  // Member asks for a fresh, short-lived token to display as a QR at the till.
  app.post('/v1/pos/token', { preHandler: [requireMember] }, async (req) => {
    return issuePosToken(memberId(req));
  });

  // Server-to-server: the POS/till verifies a scanned token. Protected by a
  // shared POS key (not a member JWT). Returns the member id for earn/redeem.
  app.post('/v1/pos/scan', async (req, reply) => {
    if (config.POS_SCAN_KEY && req.headers['x-pos-key'] !== config.POS_SCAN_KEY) {
      throw unauthorized('invalid pos key');
    }
    const { token } = parse(z.object({ token: z.string() }), req.body);
    const { memberId: id } = verifyPosToken(token); // single-use + expiry enforced
    return reply.send({ memberId: id });
  });
}
