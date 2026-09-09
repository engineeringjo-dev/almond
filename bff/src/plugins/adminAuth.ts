import type { FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config';
import { unauthorized } from '../http-error';

/**
 * THE BACK-OFFICE CREDENTIAL. A shared key in `x-admin-key`, checked in constant
 * time, failing closed when unset.
 *
 * 🔴 IT LIVES HERE, NOT IN A ROUTE FILE, BECAUSE IT HAS MORE THAN ONE CALLER AND
 * THE SECOND ONE WAS MISSING IT. `requireAdmin` was a private function inside
 * routes/corporate.ts, so /v1/analytics/order-lines — which exports up to 5,000
 * order lines carrying `memberId`, branch, item and line total — was guarded by
 * `requireMember` instead. Every customer is a member, so any signed-in customer
 * could download other customers' order history. A guard that only one file can
 * reach is a guard the next route will not use.
 *
 * FAILS CLOSED. An unset ADMIN_KEY is a locked door, never an open one — the
 * lesson /v1/pos/scan learned when `if (KEY && ...)` left it world-callable.
 */
function keyMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function requireAdmin(req: FastifyRequest): Promise<void> {
  const presented = req.headers['x-admin-key'];
  if (!config.ADMIN_KEY || typeof presented !== 'string' || !keyMatches(presented, config.ADMIN_KEY)) {
    throw unauthorized('invalid admin key');
  }
}
