import type { FastifyInstance, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { POS_MODES, type PosTokenWire } from '@almond/shared/pos/tokenWire';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import { config } from '../config';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { issueEarnTicket, issuePosToken, readEarnTicket, verifyPosToken } from '../pos/token';
import { toRedemptionView } from '@almond/shared/loyalty/redemption';
import { HttpError, badRequest, notFound } from '../http-error';
import { computeEarn } from '../earn';
import { toFils, toJod } from '../money';
import { limiter } from '../plugins/rateLimit';
import type { Backend } from '../backend';

/** Constant-time shared-key comparison — `!==` on a secret leaks its prefix. */
function keyMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** FAIL CLOSED (§G gate 0): an unset key is a closed door, never an open one.
 *  Every till route calls this first — before parsing, before rate limiting —
 *  so a caller without the key learns nothing and spends nobody's budget. */
function requirePosKey(req: FastifyRequest): void {
  const presented = req.headers['x-pos-key'];
  if (!config.POS_SCAN_KEY || typeof presented !== 'string' || !keyMatches(presented, config.POS_SCAN_KEY)) {
    // Its own machine code: a wrong key is a misconfigured TILL (alert
    // operations), never a member problem — see pos/token.ts "WHICH 401".
    throw new HttpError(401, 'pos_key_invalid', 'invalid pos key');
  }
}

/** Per till AND per key (config.RATE_LIMITS). Only a request that passed the
 *  key check is counted, so an unauthenticated flood spends nobody's budget.
 *  There is ONE valid key, so the per-key limit is a chain-wide ceiling. */
const tillEarns = limiter('pos-earn-till', () => config.RATE_LIMITS.posEarnPerTill);
const keyEarns = limiter('pos-earn-key', () => config.RATE_LIMITS.posEarnPerKey);
const tillSettles = limiter('pos-settle-till', () => config.RATE_LIMITS.posSettlePerTill);
const keySettles = limiter('pos-settle-key', () => config.RATE_LIMITS.posSettlePerKey);
const KEY_BUCKET = 'pos-key';
function limitTill(req: FastifyRequest, till: typeof tillEarns, key: typeof keyEarns): void {
  // Both checked before either is counted, so a refusal by one does not
  // spend the other's budget.
  till.check(req.ip);
  key.check(KEY_BUCKET);
  till.hit(req.ip);
  key.hit(KEY_BUCKET);
}

/** How far a till's clock may run ahead of ours before `paidAt` is refused. A
 *  future-dated sale would date the window spend ahead (the window ignores
 *  future days — a lost visit for the member). */
const PAID_AT_MAX_SKEW_MS = 5 * 60 * 1000;

const earnBody = z.object({
  earnTicket: z.string().min(1).max(1024),
  // The POS order's own unique reference (Odoo pos.order `name`, e.g.
  // "Shop/0042") — the idempotency key for this sale.
  posOrderRef: z.string().min(1).max(64),
  // ISO-8601 WITH an explicit offset ("2026-09-23T10:15:00Z" or
  // "…+03:00"). A naive timestamp is refused: "10:15" is two different
  // instants in Amman and in UTC, and the day it lands on dates the spend.
  branchId: z.string().min(1).max(64),
  // JOD the till collected in MONEY, tax-inclusive — NOT the part paid with an
  // Almond redemption. Whole fils: a till never holds a fraction of one.
  paidTotal: z.number().finite().nonnegative().max(100_000)
    .refine((v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-6, 'paidTotal has more than 3 decimals (fils)'),
  paidAt: z.string().datetime({ offset: true }).optional(),
});

const reverseBody = z.object({
  posOrderRef: z.string().min(1).max(64),
  reason: z.string().trim().min(1).max(200),
});

/** The member's stated intent. Optional and defaulted, so a client that has not
 *  been updated still gets a usable token rather than a 400 in front of a
 *  cashier. `POS_MODES` is the shared list, so the enum here cannot drift from
 *  the one the wire contract validates on the phone. */
const tokenBody = z.object({
  mode: z.enum(POS_MODES).optional(),
});

export function registerPosRoutes(app: FastifyInstance, backend: Backend): void {
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
    requirePosKey(req);
    const { token } = parse(z.object({ token: z.string() }), req.body);
    const { memberId: id, mode } = verifyPosToken(token); // single-use + expiry enforced

    /**
     * 🔴 THE STANDING DISCOUNT TRAVELS WITH THE SCAN, AND IT IS RESOLVED HERE.
     *
     * Owner, 2026-09-08, on how an employee proves entitlement: «رح يعمل redeem
     * ل qr code بتكون صلاحيته دقيقة منذ انشاءه» — a QR whose life is one minute.
     * That is what this token already is: HMAC-signed, single-use, and
     * POS_TOKEN_TTL_SECONDS is 60. So there is nothing to invent; the till just
     * needs to be TOLD the percentage when it scans one.
     *
     * The alternative — a per-company code printed on a card — was considered
     * and is worse: a code that opens a 50% discount is shared on WhatsApp
     * within a week, and nothing about it identifies who used it. This is bound
     * to the member, expires in a minute, and cannot be replayed.
     *
     * `earnsPoints` is stated so the till does not have to know the rule.
     */
    const entitlement = await backend.entitlementFor(id);
    // A `redeem` scan carries the member's live code, so the till learns what
    // to take off the bill from the same scan that identified them.
    await backend.sweepRedemptions(id, new Date());
    const redemption = mode === 'redeem' ? await backend.activeRedemption(id) : null;
    /**
     * 🔴 THE EARN TICKET — the only way a till can grant this member points.
     * Issued on an EARNING scan (pay/earn QR, a member who earns: not a
     * corporate one) and spent once by POST /v1/pos/earn when the till has
     * taken the money. It names the member the phone proved, so a till holding
     * the POS key still cannot grant points to a member id of its choosing.
     */
    const earnsPoints = !entitlement;
    const ticket = earnsPoints && (mode === 'pay' || mode === 'earn') ? issueEarnTicket(id) : null;
    return reply.send({
      memberId: id,
      mode,
      redemption: redemption && toRedemptionView(redemption, new Date()),
      corporate: entitlement && {
        companyId: entitlement.company.id,
        nameAr: entitlement.company.nameAr,
        nameEn: entitlement.company.nameEn,
        percentOff: entitlement.percentOff,
      },
      earnsPoints,
      earnTicket: ticket?.ticket ?? null,
      earnTicketExpiresIn: ticket?.expiresIn ?? null,
    });
  });

  /**
   * SETTLE a redemption — the till has given the member their discount, so the
   * code is now spent.
   *
   * 🔴 SEPARATE FROM /v1/pos/scan, AND THAT IS THE POINT. Scanning is a READ:
   * it tells the cashier what the member holds. Settling is the write that
   * consumes it. Folding them together would burn a code the moment it was
   * looked at — so a scan that a cashier then cancelled, or a scanner that
   * fired twice, would cost the member their points with nothing to show.
   *
   * Accepts EITHER a scanned POS token (the QR) or the code read aloud, because
   * a scanner that will not read a cracked screen is an ordinary Tuesday and
   * the member should not lose their redemption to it.
   */
  app.post('/v1/pos/redemption/settle', async (req, reply) => {
    requirePosKey(req);
    // A code read aloud is 8 characters: the per-key ceiling is what keeps a
    // leaked key from guessing them, from however many addresses.
    limitTill(req, tillSettles, keySettles);
    const body = parse(z.object({
      token: z.string().optional(),
      code: z.string().optional(),
    }), req.body);
    if (!body.token && !body.code) throw badRequest('token or code is required');

    const at = new Date();
    let row = null;
    if (body.token) {
      const { memberId: id, mode } = verifyPosToken(body.token);
      // 🔴 ONLY A `redeem` QR SPENDS A REDEMPTION. The mode is a signed claim of
      // what the member asked for (pos/token.ts); a pay or earn QR — the one a
      // member shows to collect points — is not consent to consume the code
      // they are saving. Without this, a till holding ANY of a member's QRs
      // could settle their live redemption onto whatever bill it chose.
      if (mode !== 'redeem') throw badRequest('this QR is not a redemption — ask the member to open their redemption code');
      await backend.sweepRedemptions(id, at);
      row = await backend.activeRedemption(id);
    } else {
      row = await backend.findRedemptionByCode(body.code!);
      // Sweep the OWNER of the code, so an expired one is refunded and refused
      // here rather than settled a fortnight late.
      if (row) await backend.sweepRedemptions(row.memberId, at);
    }
    // One answer for "no such code" and "not this member's" — a till must not
    // be able to probe which codes exist.
    if (!row) throw notFound('redemption not found');

    const settled = await backend.settleRedemption(row.id, 'pos', at);
    return reply.code(201).send({
      settled: true,
      memberId: settled.memberId,
      valueJod: settled.valueJod,
      points: settled.points,
      redemption: toRedemptionView(settled, at),
    });
  });
  /**
   * THE TILL TOOK THE MONEY — grant the member's points for this sale.
   *
   * Owner, 2026-09-23: «اوافق النقاط بعد تاكيد الدفع» — points only after the
   * payment is confirmed. For an in-store sale the till IS the confirmation:
   * it reports the amount it collected, against the earn ticket the member's
   * own QR produced at /v1/pos/scan.
   *
   * The grant is computed by the SAME shared function checkout uses
   * (computeEarn: tax-inclusive total, the member's window standing and held
   * rung, 0 for a corporate member) and lands in ONE transaction with the
   * window spend and the pos_sales row (Backend.tillEarn).
   *
   * Idempotent by posOrderRef, durably: a retrying till gets the stored answer
   * with `replay: true` and nothing is granted twice.
   */
  app.post('/v1/pos/earn', async (req, reply) => {
    requirePosKey(req);
    limitTill(req, tillEarns, keyEarns);
    const body = parse(earnBody, req.body);
    // Signature first — a ticket we did not sign is not even looked up, so the
    // route cannot be used to probe which order references exist. Expiry and
    // the sale window are NOT enforced here: they refuse a NEW sale, and a
    // till's delayed retry of a sale already paid must still get its answer
    // (Backend.tillEarn applies `ticketRefusal` only when it would create).
    const ticket = readEarnTicket(body.earnTicket);
    const now = new Date();
    // Always send paidAt: absent, it is the DELIVERY time, which for an
    // outbox retry days later is outside the ticket's sale window.
    const paidAt = body.paidAt ? new Date(body.paidAt) : now;
    if (paidAt.getTime() > now.getTime() + PAID_AT_MAX_SKEW_MS) throw badRequest('paidAt is in the future — check the till clock');
    const scannedMs = ticket.iat * 1000;
    const inWindow = paidAt.getTime() >= scannedMs - config.POS_EARN_PAID_BEFORE_SCAN_SECONDS * 1000
      && paidAt.getTime() <= scannedMs + config.POS_EARN_SALE_WINDOW_SECONDS * 1000;
    const ticketRefusal = ticket.expired ? 'expired' as const : !inWindow ? 'paid_outside_window' as const : null;
    const paidFils = toFils(body.paidTotal);
    const paidJod = toJod(paidFils);

    // The standing is read BEFORE the grant, as checkout reads it: the sale is
    // paid at the rung the member held when they walked in.
    const standing = await backend.getStanding(ticket.memberId);
    const entitlement = await backend.entitlementFor(ticket.memberId);
    // pointsRedeemed is 0 because paidTotal is ALREADY the money part only —
    // the till takes an Almond redemption off the bill before it collects.
    const earn = computeEarn({
      total: paidJod, corporate: entitlement !== null, pointsRedeemed: 0,
      windowSpend: standing.windowSpend, heldRungId: standing.held.id,
      paidFromBalance: false, comboPairs: 0, bonusDayActivated: false, at: paidAt,
    });
    const { sale, replay } = await backend.tillEarn({
      posOrderRef: body.posOrderRef, memberId: ticket.memberId, ticketJti: ticket.jti,
      ticketRefusal, branchId: body.branchId, paidFils, paidAt,
      pointsEarned: earn.points, earn: earn.points > 0 ? earn : null,
      // Money was collected, so the sale counts toward the rolling window —
      // exactly like a funded checkout, dated on the Amman day it was paid.
      spendJod: paidFils > 0 ? paidJod : null,
      spendDay: paidFils > 0 ? ammanDayKey(paidAt) : null,
      reasonAr: 'نقاط مشتريات الفرع', reasonEn: 'In-store purchase points',
      at: now,
    });
    return reply.code(replay ? 200 : 201).send({
      posOrderRef: sale.posOrderRef,
      pointsEarned: sale.pointsEarned,
      pointsBalance: sale.pointsBalanceAfter,
      replay,
    });
  });

  /**
   * THE POS ORDER WAS REFUNDED OR VOIDED — take back what it granted, once.
   * Never below zero: points the member already spent come back as
   * `shortfall`, recorded on the sale for the back-office, not clawed.
   */
  app.post('/v1/pos/earn/reverse', async (req, reply) => {
    requirePosKey(req);
    limitTill(req, tillEarns, keyEarns);
    const body = parse(reverseBody, req.body);
    const { sale, replay } = await backend.reverseTillEarn(body.posOrderRef, body.reason, new Date());
    return reply.code(replay ? 200 : 201).send({
      posOrderRef: sale.posOrderRef,
      reversedPoints: sale.reversedPoints ?? 0,
      shortfall: sale.shortfall ?? 0,
      pointsBalance: sale.reverseBalanceAfter ?? 0,
      replay,
    });
  });
}
