import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config as loyalty } from '@almond/shared/config';
import {
  normalizeReferralCode, referralShareLink, type ReferralWire,
} from '@almond/shared/loyalty/referral';
import { maskedDisplayName } from '@almond/shared/loyalty/profile';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { HttpError } from '../http-error';
import { config } from '../config';
import { limiter, rateLimit } from '../plugins/rateLimit';
import type { Backend } from '../backend';

const attaches = limiter('referral-attach', () => config.RATE_LIMITS.referralAttachPerMember);

/**
 * THE REFERRAL RAIL — owner, 2026-09-24: the REFERRER is paid
 * config.REFERRAL_REWARD_POINTS once per referred friend, when that friend's
 * FIRST PAID order is confirmed; never at signup, and the friend gets nothing.
 *
 * Two routes, and neither one pays anything:
 *   GET  /v1/me/referral         my code, my link, what it has earned;
 *   POST /v1/me/referral/attach  I am the friend: attach the code I was given.
 *
 * The PAYMENT happens in exactly one place — inside the transaction that
 * confirms the friend's first paid order (Backend.checkout for a funded app
 * order, Backend.tillEarn for a till sale that collected money) — so there is
 * no endpoint a client could call to be paid, and a replayed order cannot pay
 * twice (the referral's `rewarded_at` stamp).
 */
export function registerReferralRoutes(app: FastifyInstance, backend: Backend): void {
  app.get('/v1/me/referral', { preHandler: [requireMember] }, async (req): Promise<ReferralWire> => {
    const id = memberId(req);
    const summary = await backend.getReferral(id);
    const mine = await backend.getReferralOf(id);
    const m = await backend.getMember(id);
    return {
      code: summary.code,
      link: referralShareLink(summary.code),
      referredCount: summary.referredCount,
      rewardedCount: summary.rewardedCount,
      pointsEarned: summary.pointsEarned,
      rewardPoints: loyalty.REFERRAL_REWARD_POINTS,
      attachedCode: mine?.code ?? null,
      canAttach: mine === null && m.firstPaidAt === null,
    };
  });

  /**
   * THE FRIEND ATTACHES THE CODE THEY WERE GIVEN — once, before their first
   * paid order, not their own and not one on their own phone
   * (loyalty/referral.ts `referralAttachError`, checked under the member's
   * lock). The same code again is a replay (200), so a double-tap is harmless;
   * a different code is 409 referral_already_attached.
   *
   * Answers with the referrer's MASKED name (first name + initial, like the
   * in-store tablet) so the friend can see whose code they used — never the
   * full name, never the phone.
   */
  app.post('/v1/me/referral/attach', {
    preHandler: [requireMember, rateLimit(attaches, memberId)],
  }, async (req, reply) => {
    const id = memberId(req);
    const body = parse(z.object({ code: z.string().min(1).max(32) }), req.body);
    const code = normalizeReferralCode(body.code);
    if (!code) throw new HttpError(400, 'referral_code_invalid', 'not a referral code');
    const { referral, replay } = await backend.attachReferral(id, code, new Date());
    const referrer = await backend.getMember(referral.referrerId);
    return reply.code(replay ? 200 : 201).send({
      attached: true,
      code: referral.code,
      referrerDisplayName: maskedDisplayName(referrer.name),
      replay,
    });
  });
}
