import type { FastifyInstance } from 'fastify';
import { tiers } from '@almond/shared/loyalty';
import { liveBalance, nextExpiry } from '@almond/shared/loyalty/lots';
import type { TierId } from '@almond/shared/types';
import type { MeBalanceWire } from '@almond/shared/loyalty/balanceWire';
import { z } from 'zod';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { toJod } from '../money';
import type { Backend } from '../backend';

/** The ramp's rung ids are plain strings inside loyalty/window.ts; the wire
 *  promises a `TierId`. Resolving through the shipped tier table rather than
 *  casting means a rung the client cannot name is a LOUD failure here instead
 *  of an unmatchable id the client silently falls back to the entry rung on —
 *  which is precisely how "6% member, 2% badge" happened. */
function wireTierId(rungId: string): TierId {
  const t = tiers.find((x) => x.id === rungId);
  if (!t) throw new Error(`unknown rung id "${rungId}": the tier ramp and the shipped tier table have drifted`);
  return t.id;
}

export function registerMeRoutes(app: FastifyInstance, backend: Backend): void {
  /**
   * The member tells us who they are, and is paid once for it.
   *
   * 🔴 THE BODY CARRIES A NAME. IT DOES NOT CARRY POINTS, AND IT DOES NOT
   * CARRY "I DESERVE THE BONUS". Both would be self-crediting vectors of
   * exactly the kind the static POS QR was. The backend holds the once-only
   * stamp, decides the grant, and reports what it actually did in
   * `bonusGranted` — the client renders that number, it never proposes one.
   *
   * Not idempotency-keyed like the financial POSTs: it does not need to be. The
   * stamp makes a repeat save pay 0 rather than pay twice, so a retried request
   * converges on the same state by construction instead of by replay.
   */
  app.post('/v1/me/profile', { preHandler: [requireMember] }, async (req, reply) => {
    const id = memberId(req);
    const body = parse(
      z.object({
        // Bounded HERE as well as normalized in shared, and the two bounds do
        // DIFFERENT jobs. normalizeName truncates to MAX_NAME_LENGTH because a
        // greeting is a sentence; this one refuses a payload that was never a
        // name at all. It is deliberately far above any paste a person could
        // make by accident — a fumbled select-all of a page is trimmed and
        // saved, a megabyte is refused — because rejecting a real member's
        // clumsy paste with a 400 they cannot interpret is the worse failure.
        name: z.string().max(4096),
        // An Amman DAY KEY or null — never an ISO instant, which would render a
        // day early west of Greenwich. The regex is the shape; a nonsense date
        // like 2026-02-31 is the client's to avoid and costs nothing here.
        birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
      }),
      req.body,
    );
    // `birthday` is `.default(null)`, so zod always produces it — but the
    // inferred type keeps it optional and MemberProfile does not. Naming the
    // field rather than casting keeps the wire and the domain type honest.
    const result = await backend.setProfile(id, { name: body.name, birthday: body.birthday ?? null });
    return reply.code(200).send(result);
  });

  // The return type is the SHARED wire contract, not an inferred anonymous
  // object. This route and almond-app's LoyaltyBalance were two hand-written
  // shapes that had already drifted (tier as an object here, a TierId string
  // there) with nothing in either workspace able to notice — the client cast
  // the body with `apiGet<LoyaltyBalance>` instead of checking it, so a 6%
  // member was rendered "2%" everywhere and no error was raised. Naming the
  // wire makes a producer-side drift a typecheck failure; parseMeBalance on the
  // client makes a consumer-side drift a named throw.
  app.get('/v1/me/balance', { preHandler: [requireMember] }, async (req): Promise<MeBalanceWire> => {
    const id = memberId(req);
    const m = await backend.getMember(id);
    // The rung comes from the member's STANDING, not from tierFromSpend on a
    // spend figure. Those two answers differ for anyone whose 90-day window has
    // rolled below a threshold they already crossed: there is no demotion, so
    // the rate they are paid is max(the floor they hold, the live window).
    // Re-deriving it here from windowSpend would show a 6% member "2%".
    const standing = await backend.getStanding(id);
    const tier = tiers.find((t) => t.id === standing.held.id) ?? tiers[0];
    // THE BALANCE IS DERIVED, HERE, ON EVERY READ. There is no stored scalar to
    // fall out of date and no expiry job to have missed: a lot past its Amman
    // expiry day contributes 0 to this sum from the instant it dies. That is
    // also why this GET mutates nothing (D11) — there is nothing to mutate.
    const at = new Date();
    return {
      points: liveBalance(m.lots, at),
      windowSpend: standing.windowSpend,
      // Distinct qualifying days in the window — the other door to the second
      // rung, and the unit the progress copy is written in ("3 more visits").
      visitDays: standing.visitDays,
      tier: { id: tier.id, nameAr: tier.nameAr, nameEn: tier.nameEn, multiplier: tier.multiplier },
      nextTier: standing.next
        ? {
            id: wireTierId(standing.next.rung.id),
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
      // WHICH points die next, and HOW MANY — not one date for the whole
      // balance, because there is no such date under a per-lot rule. `on` is an
      // Amman day key; the app must format it with formatDayKey and never with
      // `new Date(string)`, which would print the day before.
      nextExpiry: nextExpiry(m.lots, at),
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
