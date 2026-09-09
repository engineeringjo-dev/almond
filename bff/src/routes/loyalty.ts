import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { isRedemptionCodeShape, toRedemptionView } from '@almond/shared/loyalty/redemption';
import { issuePosToken } from '../pos/token';
import { notFound } from '../http-error';
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
    /**
     * 🔴 THIS NOW PRODUCES SOMETHING. Owner, 2026-09-09: «حتى الي بده يصرف
     * نقاطه بده يعمل redeem ويطلع qr code مؤقت يقرأ على الكاش او رمز سري اذا
     * كان يشتري من الموقع».
     *
     * Until today this route called spendPoints and returned a number. Nothing
     * was created, nothing reached the till, and /v1/pos/scan returned only a
     * member id — so a member who redeemed against the live backend lost their
     * points and there was nothing anywhere for a cashier to act on. The app's
     * mock invented a voucher, which is exactly why it went unnoticed.
     *
     * `createRedemption` spends the points AND mints the code. If the code is
     * never used, `sweepRedemptions` returns them in full.
     */
    const row = await backend.createRedemption(id, points);
    const member = await backend.getMember(id);
    return reply.code(201).send({
      // The original three fields are unchanged, so every existing caller and
      // test keeps its answer; the redemption is added beside them.
      redeemed: true,
      pointsBalance: liveBalance(member.lots),
      // ONE conversion, in loyalty/earn.ts — and now stored on the row, so a
      // later change to the rate cannot revalue a code already issued.
      valueJod: row.valueJod,
      redemption: toRedemptionView(row, new Date()),
    });
  });

  /**
   * The member's live code, or null. What the "show at the till" screen polls.
   *
   * Reading it SWEEPS: an expired code returns its points here, which is the
   * lazy-settlement shape point-lot expiry already uses. There is no cron in
   * the BFF, so a stored flag would go on saying `pending` for months.
   */
  app.get('/v1/me/redemption', { preHandler: [requireMember] }, async (req) => {
    const id = memberId(req);
    await backend.sweepRedemptions(id, new Date());
    const row = await backend.activeRedemption(id);
    return { redemption: row ? toRedemptionView(row, new Date()) : null };
  });

  /**
   * A fresh 60-second QR for a live redemption — the thing held up to the
   * scanner. Minted on demand rather than at creation so the code on screen is
   * never more than a minute old, however long the member has been queueing:
   * «qr code مؤقت ... بتكون صلاحيته دقيقة منذ انشاءه».
   */
  app.post('/v1/me/redemption/qr', { preHandler: [requireMember] }, async (req, reply) => {
    const id = memberId(req);
    await backend.sweepRedemptions(id, new Date());
    const row = await backend.activeRedemption(id);
    if (!row) throw notFound('no active redemption');
    return reply.code(201).send({ ...issuePosToken(id, 'redeem'), redemptionId: row.id });
  });

  /** The member gave up on it. Points return immediately, not at expiry. */
  app.post('/v1/me/redemption/cancel', {
    preHandler: [requireMember, idempotencyPreHandler],
    onSend: [idempotencyOnSend],
  }, async (req, reply) => {
    const id = memberId(req);
    const { redemptionId } = parse(z.object({ redemptionId: z.string().min(1) }), req.body);
    const row = await backend.cancelRedemption(id, redemptionId, new Date());
    const member = await backend.getMember(id);
    return reply.code(200).send({
      redemption: toRedemptionView(row, new Date()),
      pointsBalance: liveBalance(member.lots),
    });
  });

  /**
   * SETTLE a redemption from the website — «او رمز سري اذا كان يشتري من الموقع».
   *
   * 🔴 THE CODE MUST BELONG TO THE MEMBER PRESENTING IT. The till may settle
   * anyone's code (it has the member in front of it and a shared POS key); a
   * website caller may settle only their OWN, or a member could spend a code
   * they shoulder-surfed off the next table. `memberId` comes from the JWT, and
   * a code belonging to someone else answers with the SAME not-found as a code
   * that does not exist — so this cannot be used to discover live codes either.
   */
  app.post('/v1/loyalty/redemption/settle', {
    preHandler: [requireMember, idempotencyPreHandler],
    onSend: [idempotencyOnSend],
  }, async (req, reply) => {
    const id = memberId(req);
    const { code } = parse(z.object({ code: z.string().min(1).max(32) }), req.body);
    if (!isRedemptionCodeShape(code)) throw notFound('redemption not found');

    const at = new Date();
    await backend.sweepRedemptions(id, at);
    const row = await backend.findRedemptionByCode(code);
    if (!row || row.memberId !== id) throw notFound('redemption not found');

    const settled = await backend.settleRedemption(row.id, 'web', at);
    return reply.code(201).send({
      settled: true,
      valueJod: settled.valueJod,
      points: settled.points,
      redemption: toRedemptionView(settled, at),
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
