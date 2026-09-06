import type { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { config } from '../config';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { issuePosToken, verifyPosToken } from '../pos/token';
import { unauthorized } from '../http-error';
import type { Backend } from '../backend';

/** Constant-time shared-key comparison — `!==` on a secret leaks its prefix. */
function keyMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registerPosRoutes(app: FastifyInstance, _backend: Backend): void {
  // Member asks for a fresh, short-lived token to display as a QR at the till.
  app.post('/v1/pos/token', { preHandler: [requireMember] }, async (req) => {
    return issuePosToken(memberId(req));
  });

  // Server-to-server: the POS/till verifies a scanned token. Protected by a
  // shared POS key (not a member JWT). Returns the member id for earn/redeem.
  app.post('/v1/pos/scan', async (req, reply) => {
    // FAIL CLOSED (§G gate 0). This used to read `if (config.POS_SCAN_KEY && ...)`,
    // so an UNSET key — which is the default in bff/src/config.ts — skipped the
    // comparison entirely and left the endpoint world-callable: anyone holding a
    // scanned token could resolve it to a member id with no credential at all.
    // An unconfigured key is now a closed door, not an open one.
    const presented = req.headers['x-pos-key'];
    if (!config.POS_SCAN_KEY || typeof presented !== 'string' || !keyMatches(presented, config.POS_SCAN_KEY)) {
      throw unauthorized('invalid pos key');
    }
    const { token } = parse(z.object({ token: z.string() }), req.body);
    const { memberId: id } = verifyPosToken(token); // single-use + expiry enforced
    return reply.send({ memberId: id });
  });
}
