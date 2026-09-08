import type { FastifyInstance } from 'fastify';
import { tiers } from '@almond/shared/loyalty';
import { requireMember, memberId } from '../plugins/auth';
import { toJod } from '../money';
import type { Backend } from '../backend';

export function registerMeRoutes(app: FastifyInstance, backend: Backend): void {
  app.get('/v1/me/balance', { preHandler: [requireMember] }, async (req) => {
    const id = memberId(req);
    const m = await backend.getMember(id);
    // The rung comes from the member's STANDING, not from tierFromSpend on a
    // spend figure. Those two answers differ for anyone whose 90-day window has
    // rolled below a threshold they already crossed: there is no demotion, so
    // the rate they are paid is max(the floor they hold, the live window).
    // Re-deriving it here from windowSpend would show a 6% member "2%".
    const standing = await backend.getStanding(id);
    const tier = tiers.find((t) => t.id === standing.held.id) ?? tiers[0];
    return {
      points: m.points,
      windowSpend: standing.windowSpend,
      // Distinct qualifying days in the window — the other door to the second
      // rung, and the unit the progress copy is written in ("3 more visits").
      visitDays: standing.visitDays,
      tier: { id: tier.id, nameAr: tier.nameAr, nameEn: tier.nameEn, multiplier: tier.multiplier },
      nextTier: standing.next
        ? {
            id: standing.next.rung.id,
            threshold: standing.next.rung.threshold,
            jodRemaining: standing.next.jodRemaining,
            visitsRemaining: standing.next.visitsRemaining,
            // Whether that count is the visits door (a guarantee) or a spend
            // projection. The app renders a definite sentence only for the
            // former — see almond-app/lib/tierCopy.ts.
            visitsGuaranteed: standing.next.visitsGuaranteed,
            step: standing.next.step,
          }
        : null,
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
