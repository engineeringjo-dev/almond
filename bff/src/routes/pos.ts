import type { FastifyInstance, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { POS_MODES, type PosTokenWire } from '@almond/shared/pos/tokenWire';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import { config } from '../config';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import {
  issueEarnTicket, issuePosToken, issueSpendTicket, readEarnTicket, readSpendTicket, verifyPosToken,
} from '../pos/token';
import { toRedemptionView } from '@almond/shared/loyalty/redemption';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { jodFromPoints, spendableJod } from '@almond/shared/loyalty/earn';
import { maskedDisplayName } from '@almond/shared/loyalty/profile';
import { normalizeJordanPhone } from '@almond/shared/lib/phone';
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
const tillSpends = limiter('pos-spend-till', () => config.RATE_LIMITS.posSpendPerTill);
const keySpends = limiter('pos-spend-key', () => config.RATE_LIMITS.posSpendPerKey);
const tillIdentifies = limiter('pos-identify-till', () => config.RATE_LIMITS.posIdentifyPerTill);
const keyIdentifies = limiter('pos-identify-key', () => config.RATE_LIMITS.posIdentifyPerKey);
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

/** JOD in whole fils: a till never holds a fraction of one. */
const jodAmount = z.number().finite().nonnegative().max(100_000)
  .refine((v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-6, 'more than 3 decimals (fils)');

const earnBody = z.object({
  earnTicket: z.string().min(1).max(1024),
  // The POS order's own unique reference (Odoo pos.order `name`, e.g.
  // "Shop/0042") — the idempotency key for this sale.
  posOrderRef: z.string().min(1).max(64),
  // ISO-8601 WITH an explicit offset ("2026-09-23T10:15:00Z" or
  // "…+03:00"). A naive timestamp is refused: "10:15" is two different
  // instants in Amman and in UTC, and the day it lands on dates the spend.
  branchId: z.string().min(1).max(64),
  // JOD the till collected in MONEY, tax-inclusive — NOT the part paid with
  // points (the /v1/pos/points/spend tender, same posOrderRef) and NOT an Almond
  // redemption. 🔴 THE SERVER CANNOT CHECK THIS: it sees the spend row but not
  // the bill, so it has no way to know whether 5.000 is "the bill" or "the bill
  // minus the points". The till must subtract the points tender before it
  // reports; a till that sends the whole bill makes points earn points, which
  // is exactly what the owner ruled out («لا يكسب نقاط على الجزء المدفوع
  // بالنقاط»). bff/test/pos-spend.test.ts pins the documented behaviour.
  // Whole fils: a till never holds a fraction of one.
  paidTotal: jodAmount,
  paidAt: z.string().datetime({ offset: true }).optional(),
});

const reverseBody = z.object({
  posOrderRef: z.string().min(1).max(64),
  reason: z.string().trim().min(1).max(200),
});

/**
 * POST /v1/pos/earn/reverse. Without the two refund fields it is the FULL
 * reversal it always was (of whatever is left). With them it is a PARTIAL
 * refund: `refundRef` is the refund's own POS reference (Odoo's refund
 * pos.order `name`) — its idempotency key — and `refundedTotal` the MONEY
 * refunded, tax-inclusive JOD, on the same basis as the sale's paidTotal (the
 * part that earned; never a points tender). Both or neither.
 */
const earnReverseBody = reverseBody.extend({
  refundRef: z.string().min(1).max(64).optional(),
  refundedTotal: jodAmount.refine((v) => v > 0, 'refundedTotal must be more than 0').optional(),
}).refine((b) => (b.refundRef === undefined) === (b.refundedTotal === undefined),
  'refundRef and refundedTotal come together — a partial refund needs both, a full reversal neither');

/** POST /v1/pos/points/spend. `points` are WHOLE points (1 point = 1 qirsh):
 *  the till converts the tender the member asked for with the scan's
 *  `spendableJod` / 100, never the other way round. */
const spendBody = z.object({
  spendTicket: z.string().min(1).max(1024),
  posOrderRef: z.string().min(1).max(64),
  points: z.number().int().positive(),
});
const spendReverseBody = reverseBody;

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
     * 🔴 ONE CODE, ONE SCAN, BOTH TICKETS (owner, 2026-09-24: «كسب وصرف النقاط
     * بدي يكون باركود مباشر نفسه»). The member no longer picks a mode on the
     * phone; they say at the counter whether to use their points. So a scan of
     * the member code hands the till everything the visit can need:
     *
     *   earnTicket   the only way a till can GRANT this member points — spent
     *                once by POST /v1/pos/earn after the money is taken. Null
     *                for a corporate member, who earns 0 (the discount IS the
     *                reward) but may still SPEND points they hold.
     *   spendTicket  the only way a till can TAKE points off this member's
     *                balance as a tender — POST /v1/pos/points/spend, within
     *                config.POS_SPEND_TICKET_TTL_SECONDS (15 min) of this scan.
     *                The member presenting their own code is the consent.
     *
     * Both name the member the phone proved, so a till holding the POS key
     * still cannot choose whose points to grant or spend.
     *
     * `mode` is still read, for backward compatibility with apps that mint
     * 'pay'/'earn'/'corporate' codes — all three are the member code now. The
     * one exception is a legacy 'redeem' QR: that is a READ of a redemption
     * code the member already paid for (the typed/web fallback), not the
     * member code, and it carries no tickets.
     */
    const earnsPoints = !entitlement;
    const memberCode = mode !== 'redeem';
    const ticket = earnsPoints && memberCode ? issueEarnTicket(id) : null;
    const spend = memberCode ? issueSpendTicket(id) : null;
    // The balance AFTER the sweep above, so an expired redemption's refund is
    // already in it. Read-only: the till shows it, the spend route re-checks.
    const pointsBalance = liveBalance((await backend.getMember(id)).lots);
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
      pointsBalance,
      // What the balance can take off THIS bill, floored to the fils — the
      // points tender the till may offer.
      spendableJod: spendableJod(pointsBalance),
      spendTicket: spend?.ticket ?? null,
      spendTicketExpiresIn: spend?.expiresIn ?? null,
    });
  });

  /**
   * EARN BY PHONE NUMBER, ON THE IN-STORE TABLET.
   *
   * Owner, 2026-09-24: «اذا بدك تكسب نقاط يا بتحط رقمك عالتابلت بالمحل يا يتفتح
   * من كبسة باركود» — to earn, either type your number on the tablet or open
   * the code. This is the first door.
   *
   * 🔴 EARN ONLY — BY CONSTRUCTION. Typing a number proves nothing about who is
   * standing at the counter; it could be anyone's number. So this route hands
   * back an EARN ticket (the worst a wrong number does is credit someone else)
   * and NEVER a spend ticket, a balance or anything that lets points be spent —
   * spending needs the member's own app code (the scan). The reply's key set is
   * fixed and tested so a future field cannot leak a balance through here.
   *
   * An unknown number is `memberFound: false` — the tablet invites them to
   * download the app. It does NOT create a member: an unverified number that
   * became an account would let anyone open one in someone else's name, and
   * OTP sign-in is the only door into the member table.
   */
  app.post('/v1/pos/identify', async (req, reply) => {
    requirePosKey(req);
    limitTill(req, tillIdentifies, keyIdentifies);
    const body = parse(z.object({ phone: z.string().min(1).max(32) }), req.body);
    // THE shared Jordan normaliser — the same one OTP sign-in stored the
    // member's phone with, so «0791234567», «+962 79 123 4567» and «٠٧٩…»
    // all find the one member.
    const phone = normalizeJordanPhone(body.phone);
    if (!phone) throw new HttpError(400, 'phone_invalid', 'not a Jordanian mobile number');
    const m = await backend.findMemberByPhone(phone);
    if (!m) {
      return reply.send({ memberFound: false, earnTicket: null, displayName: null, earnsPoints: false });
    }
    // The same rule as the scan: a standing-discount holder earns nothing.
    const earnsPoints = !(await backend.entitlementFor(m.id));
    const ticket = earnsPoints ? issueEarnTicket(m.id) : null;
    return reply.send({
      memberFound: true,
      earnTicket: ticket?.ticket ?? null,
      displayName: maskedDisplayName(m.name),
      earnsPoints,
    });
  });

  /**
   * THE MEMBER PAYS WITH POINTS — take them off the bill as a TENDER.
   *
   * One visit, one scan: the till got a spend ticket from /v1/pos/scan, the
   * member said "use my points", and the till asks for exactly `points`. They
   * come off the balance oldest lot first (the shared consumeFifo), in ONE
   * transaction with the ledger line and the pos_point_spends row
   * (Backend.tillSpend). The till puts `valueJod` on the bill as the points
   * tender, and reports only the MONEY part to /v1/pos/earn under the same
   * posOrderRef — «لا يكسب نقاط على الجزء المدفوع بالنقاط».
   *
   * Idempotent by posOrderRef: a retry gets the stored answer (`replay`), a
   * different member or amount is 409. More than the balance is 409
   * insufficient_points; more than config.POS_SPEND_MAX_POINTS_PER_SALE is 400
   * points_over_sale_cap. Neither moves anything.
   */
  app.post('/v1/pos/points/spend', async (req, reply) => {
    requirePosKey(req);
    limitTill(req, tillSpends, keySpends);
    const body = parse(spendBody, req.body);
    // Signature first: a ticket we did not sign — an EARN ticket included,
    // which is all /v1/pos/identify ever hands out — is not even looked up.
    const ticket = readSpendTicket(body.spendTicket);
    if (body.points > config.POS_SPEND_MAX_POINTS_PER_SALE) {
      throw new HttpError(400, 'points_over_sale_cap',
        `at most ${config.POS_SPEND_MAX_POINTS_PER_SALE} points may be spent on one sale`);
    }
    const { spend, replay } = await backend.tillSpend({
      posOrderRef: body.posOrderRef, memberId: ticket.memberId, ticketJti: ticket.jti,
      ticketExpired: ticket.expired, points: body.points,
      // THE shared conversion, once; stored on the row so a later rate change
      // cannot revalue a tender already on a receipt.
      valueJod: jodFromPoints(body.points),
      reasonAr: 'دفع بالنقاط في الفرع', reasonEn: 'Paid with points in store',
      at: new Date(),
    });
    return reply.code(replay ? 200 : 201).send({
      posOrderRef: spend.posOrderRef,
      pointsSpent: spend.points,
      valueJod: spend.valueJod,
      pointsBalance: spend.pointsBalanceAfter,
      replay,
    });
  });

  /**
   * THE TILL VOIDED A SALE PAID (PARTLY) WITH POINTS — give them back, once.
   * Each slice returns with the expiry it was spent from, never a fresh year;
   * a slice that died in the meantime is reported as `pointsExpired`.
   */
  app.post('/v1/pos/points/spend/reverse', async (req, reply) => {
    requirePosKey(req);
    limitTill(req, tillSpends, keySpends);
    const body = parse(spendReverseBody, req.body);
    const { spend, replay } = await backend.reverseTillSpend(body.posOrderRef, body.reason, new Date());
    return reply.code(replay ? 200 : 201).send({
      posOrderRef: spend.posOrderRef,
      pointsReturned: spend.returnedPoints ?? 0,
      pointsExpired: spend.expiredPoints ?? 0,
      pointsBalance: spend.reverseBalanceAfter ?? 0,
      replay,
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
    // the till takes the points tender (and any Almond redemption) off the
    // bill before it reports what it collected.
    //
    // 🔴 NO COMBO AT THE TILL — `combo` is omitted, on purpose. The till reports
    // one number (paidTotal), never the lines, so the server cannot tell a
    // drink+food pair from any other 4.40 JOD, and the combo neither adds its
    // points nor removes the pair's regular ones here: an in-store invoice
    // earns the plain rate on the whole paid total. The combo is an app/web
    // checkout offer until the till contract carries lines (INTEGRATIONS §2).
    const earn = computeEarn({
      total: paidJod, corporate: entitlement !== null, pointsRedeemed: 0,
      windowSpend: standing.windowSpend, heldRungId: standing.held.id,
      paidFromBalance: false, bonusDayActivated: false, at: paidAt,
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
   * THE POS ORDER WAS REFUNDED OR VOIDED — take back what it granted.
   *
   * Owner, 2026-09-24: «المرتجع يلغي نقاط الجزء المرتجع». With {refundRef,
   * refundedTotal} this is a PARTIAL refund and takes back only that part's
   * share of the points — round(pointsEarned × refundedTotal / paidTotal),
   * cumulative across refunds so the parts never add up to more than was
   * earned (@almond/shared loyalty/tillRefund.ts) — and takes refundedTotal out
   * of the member's rolling window. Idempotent by refundRef. Without them it
   * is the FULL reversal of whatever is left, idempotent by posOrderRef.
   *
   * Never below zero: points the member already spent come back as
   * `shortfall`, recorded for the back-office, not clawed. The figures in the
   * reply are THIS refund's; `refundedTotal` and `fullyReversed` are the sale's.
   */
  app.post('/v1/pos/earn/reverse', async (req, reply) => {
    requirePosKey(req);
    limitTill(req, tillEarns, keyEarns);
    const body = parse(earnReverseBody, req.body);
    const partial = body.refundRef !== undefined && body.refundedTotal !== undefined
      ? { refundRef: body.refundRef, refundedFils: toFils(body.refundedTotal) }
      : undefined;
    const { sale, refund, replay } = await backend.reverseTillEarn(body.posOrderRef, body.reason, new Date(), partial);
    const fullyReversed = sale.status === 'reversed';
    return reply.code(replay ? 200 : 201).send({
      posOrderRef: sale.posOrderRef,
      refundRef: refund.refundRef,
      reversedPoints: refund.reversedPoints,
      shortfall: refund.shortfall,
      pointsBalance: refund.balanceAfter,
      // Money refunded on this sale so far — all of it once fully reversed.
      refundedTotal: toJod(fullyReversed ? sale.paidFils : sale.refundedFils),
      fullyReversed,
      replay,
    });
  });
}
