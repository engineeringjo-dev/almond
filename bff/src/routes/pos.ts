import type { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { POS_MODES, type PosTokenWire } from '@almond/shared/pos/tokenWire';
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

/** The member's stated intent. Optional and defaulted, so a client that has not
 *  been updated still gets a usable token rather than a 400 in front of a
 *  cashier. `POS_MODES` is the shared list, so the enum here cannot drift from
 *  the one the wire contract validates on the phone. */
const tokenBody = z.object({
  mode: z.enum(POS_MODES).optional(),
});

export function registerPosRoutes(app: FastifyInstance, _backend: Backend): void {
  // Member asks for a fresh, short-lived token to display as a QR at the till.
  //
  // The return type is the SHARED wire contract (@almond/shared/pos/tokenWire),
  // not an inferred anonymous object, for the same reason GET /v1/me/balance is
  // annotated: producer-side drift becomes a typecheck failure here rather than
  // a surprise on a phone held up to a scanner. The consumer parses it with
  // parsePosToken, which refuses the retired static barcode outright.
  app.post('/v1/pos/token', { preHandler: [requireMember] }, async (req): Promise<PosTokenWire> => {
    // The member is the JWT SUBJECT, never a body field. That is the property
    // the old barcode did not have: it was built client-side out of a member id
    // that is printed under the QR, so anyone who could read one could mint one.
    const { mode } = parse(tokenBody, req.body ?? {});
    return issuePosToken(memberId(req), mode ?? 'pay');
  });

  // Server-to-server: the POS/till verifies a scanned token. Protected by a
  // shared POS key (not a member JWT). Returns the member id for earn/redeem,
  // and the mode the member selected on their phone — which is the only way
  // that choice reaches the till now that the barcode is opaque. It is read off
  // the VERIFIED payload, so it is as trustworthy as the member id beside it.
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
    const { memberId: id, mode } = verifyPosToken(token); // single-use + expiry enforced
    return reply.send({ memberId: id, mode });
  });
}
