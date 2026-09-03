import type { FastifyInstance } from 'fastify';
// The earn multiplier is applied only in loyalty/earn.ts, never from a route.
// earn-arith-exempt: GET /v1/me/balance reports the member's tier. §7 T7.
import { tierFromSpend, nextTier } from '@almond/shared/loyalty';
import { requireMember, memberId } from '../plugins/auth';
import { toJod } from '../money';
import type { Backend } from '../backend';

export function registerMeRoutes(app: FastifyInstance, backend: Backend): void {
  app.get('/v1/me/balance', { preHandler: [requireMember] }, async (req) => {
    const m = await backend.getMember(memberId(req));
    // earn-arith-exempt: tier shown to the member; no invoice, no grant. §7 T7.
    const tier = tierFromSpend(m.windowSpend);
    const next = nextTier(m.windowSpend);
    return {
      points: m.points,
      windowSpend: m.windowSpend,
      tier: { id: tier.id, nameAr: tier.nameAr, nameEn: tier.nameEn, multiplier: tier.multiplier },
      nextTier: next ? { id: next.id, threshold: next.threshold } : null,
    };
  });

  app.get('/v1/me/wallet', { preHandler: [requireMember] }, async (req) => {
    const m = await backend.getMember(memberId(req));
    return { balance: toJod(m.walletFils) };
  });

  app.get('/v1/me/history', { preHandler: [requireMember] }, async (req) => {
    return backend.getHistory(memberId(req));
  });
}
