import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { idempotency } from '../plugins/idempotency';
import { reprice } from '../pricing';
import { corporateDiscountAmount } from '@almond/shared/loyalty/corporate';
import { computeEarn } from '../earn';
import { assignHoldout, holdoutSpecFromConfig, stampAllExperiments } from '@almond/shared/loyalty/holdout';
import { toSecondVisitView } from '@almond/shared/loyalty/secondVisit';
import { toFils, toJod } from '../money';
import { recordOrderLines } from '../analytics/orderLines';
import type { Backend } from '../backend';
import { unfundedValueAllowed } from '../plugins/funding';

const bodySchema = z.object({
  // Bounded: the branch id is copied into every order line the forecasting
  // store keeps, and an unbounded string there is a megabyte per request.
  branchId: z.string().min(1).max(64),
  orderType: z.enum(['pickup', 'dinein', 'delivery']),
  paymentMethod: z.enum(['cash', 'cliq', 'visa', 'mastercard', 'paypal', 'wallet']),
  lines: z.array(z.object({
    itemId: z.string(),
    sizeId: z.enum(['S', 'M', 'L']),
    optionIds: z.array(z.string()).default([]),
    qty: z.number().int().positive().max(1000),
  })).min(1).max(500),
});

export function registerCheckoutRoutes(app: FastifyInstance, backend: Backend): void {
  const idem = idempotency(backend);
  app.post('/v1/checkout', {
    preHandler: [requireMember, idem.preHandler],
    onSend: [idem.onSend],
  }, async (req, reply) => {
    const id = memberId(req);
    const input = parse(bodySchema, req.body);
    // The rung is read BEFORE the transaction is recorded, so the grant is
    // computed on the window as it stood when the member walked in. `standing`
    // is a read: it never mutates, and it already combines the live 90-day
    // window with the floor the member holds (there is no demotion).
    //
    // WHICH INVOICE FIRST GETS A NEW RATE, precisely — three comments used to
    // say the opposite of the code here. An invoice that CROSSES a threshold is
    // paid at the old rung; the new rate starts on the next one. What is
    // immediate is that a member who already qualifies is paid for it NOW
    // rather than at the next quarterly boundary (window.ts:29-45) — the
    // promotion is not deferred, the crossing invoice is not back-credited.
    // Recomputing the standing after recordSpend would change the offer
    // (~0.10-0.20 JOD per promoted member): an owner decision, not a tidy-up.
    // W1-10 pins the current behaviour on the wire.
    const standing = await backend.getStanding(id);

    // 1) Authoritative re-price from the menu (ignore any client totals).
    /**
     * 🔴 THE STANDING CORPORATE DISCOUNT — resolved from the member's STORED
     * phone, never from the request body. An Almond employee pays half; a Save
     * the Children card pays 80%. There is no endpoint through which a client
     * can name its own company.
     *
     * It is applied INSIDE the authoritative re-price, before anything is
     * debited, so every downstream number is the amount the member actually
     * paid: what the wallet is charged, what the rolling window records, and
     * what the tax is computed on. Discounting the receipt afterwards would
     * charge full price and tax the discount away.
     */
    const entitlement = await backend.entitlementFor(id);
    const { items, totals, comboPairs, hasDrink } = reprice(
      input.lines,
      entitlement
        ? (subtotal) => corporateDiscountAmount(subtotal, entitlement.percentOff)
        : undefined,
    );
    // One instant for this whole request. It dates the voucher's 30-day life,
    // which is an INSTANT and not a business day — Asia/Amman is UTC+3
    // year-round, so 30 × 86.4e6 ms is exactly 30 Amman calendar days. The
    // business-day machinery (ammanDayKey) still owns the DISPLAYED date.
    const now = new Date();
    const paidFromBalance = input.paymentMethod === 'wallet';
    /**
     * 🔴 POINTS AND WINDOW SPEND ONLY FOR MONEY THAT MOVED.
     *
     * Only the wallet is debited here; cash/CliQ/card are captured nowhere in
     * this route. Granting on them paid points — which /v1/loyalty/redeem turns
     * into a code the till takes off a bill — for an order nobody paid, as
     * often as a script could POST it (measured: a 60-coffee "cash" order,
     * 200 points, redeemed for 2 JOD, repeatable). It also credited the 90-day
     * window, and a rung once reached is never taken away, so three fake
     * orders bought the top earn rate for life. The ORDER is still written: a
     * pay-at-counter order is a real order. Its points are the till's to grant
     * when the till takes the money. See plugins/funding.ts.
     */
    const funded = paidFromBalance || unfundedValueAllowed();

    // Bonus-day activation is not yet server-side state (promoStore is on the
    // device). Until POST /v1/promo/bonus-day/activate exists, the server
    // never pays the bonus day — a client-asserted flag would be a
    // self-crediting vector. See docs/LOYALTY-EARN-PATCH.md §3.2 / §8.1.
    //
    // 🔴 WHAT THE MEMBER PAID FOR THIS ORDER WITH POINTS — `pointsRedeemed`
    // below. Points are money (owner, 2026-09-08) and the part of a bill paid
    // with them earns nothing, so computeEarn takes the redeemed points off
    // the invoice before the ceiling and before the rate.
    //
    // IT IS ZERO HERE, AND THAT IS A FACT ABOUT THIS ROUTE, NOT A DEFAULT.
    // /v1/checkout takes NO payment in points: its body has no points field,
    // reprice() prices the menu, and the only balance it can debit is the
    // wallet. Redemption is a SEPARATE rail — POST /v1/loyalty/redeem spends
    // points and hands back `valueJod` for the till to take off an Odoo order
    // this route never sees, exactly like the second-visit voucher's free
    // line. Nothing in this repo joins a redemption to an order id, so there
    // is no number to pass here and inventing one ("points spent in the last
    // few minutes") would be a guess written into a grant.
    //
    // WHEN THE TWO RAILS ARE JOINED — a points field on this body, or an Odoo
    // POS order carrying both the redemption and the sale — the real figure
    // goes in on that line, and it must be the points ACTUALLY spent against
    // THIS invoice, resolved server-side and never asserted by a client.
    // Until then a member who redeems at the till and then orders in the app
    // earns on the full app invoice, because those are two different bills.
    //
    // Computed BEFORE anything is written: the grant depends only on the
    // invoice and the standing read above, never on the order id.
    const earn = computeEarn({
      total: totals.total,          // tax-inclusive, per §1.1
      corporate: entitlement !== null,   // zero points; see loyalty/corporate.ts
      pointsRedeemed: 0,            // see above: no points rail on this route
      windowSpend: standing.windowSpend,
      // The FLOOR, not an override: computeEarn pays max(live rung, held
      // rung), so a member whose 90-day window has rolled off keeps the rate
      // they reached — there is no demotion (config/index.ts:186-191). Which
      // invoice first gets a NEW rate is settled where `standing` is read.
      heldRungId: standing.held.id,
      paidFromBalance,
      comboPairs,
      bonusDayActivated: false,
    });

    // 2) ONE transaction: debit, order, voucher, corporate use, grant, spend.
    //
    // 🔴 THIS WAS A THREE-TRANSACTION SAGA. debitWallet, createOrder and
    // addPoints each committed on their own, and the compensating refund ran
    // only on a thrown error — so a process that died after the debit (a
    // deploy, an OOM) kept the member's money and wrote no order. There is
    // nothing to compensate now: Backend.checkout commits every row or none,
    // and `insufficient_wallet` is refused having written nothing.
    //
    // The route still decides every NUMBER — the price above, the grant, the
    // funded gate — through @almond/shared; the backend only moves them.
    const result = await backend.checkout(id, {
      order: {
        branchId: input.branchId, type: input.orderType,
        paymentMethod: input.paymentMethod,
        subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
        // The experiment arms this member was in when the order was written
        // (§4.11's snapshot). RECORDED, NEVER ACTED ON HERE: nothing in this
        // route branches on an arm, and no field of the 201 body carries one —
        // a control arm that knows it is one is not a control arm.
        experimentArms: stampAllExperiments(id),
      },
      // NOTE: card/cliq payments would capture via a PSP here (out of scope).
      walletDebitFils: paidFromBalance ? toFils(totals.total) : 0,
      pointsEarned: funded ? earn.points : 0,
      pointsReasonAr: 'نقاط طلب',
      pointsReasonEn: 'Order points',
      // The whole breakdown is persisted on the order (§5b) so a grant can be
      // re-derived and the shadow delta reconstructed after the fact. An
      // unfunded order records none: a breakdown describes a grant, and there
      // was not one.
      earn: funded ? earn : null,
      // Dated and pruned to the rolling window — never `windowSpend += jod`.
      spendJod: funded ? totals.total : null,
      // 🔴 THE USE IS LOGGED, NOT INFERRED. «بدي يبين عندي كل موظف شو اخذ درنك،
      // وكم مرة استخدم خصمه» — which drink each employee took, and how many
      // times they used their discount. That cannot be reconstructed later
      // from orders alone: the rate a company is on changes, and re-reading
      // today's percentage against last month's orders would rewrite history.
      // So the rate that actually applied is written down with the items, in
      // the same transaction as the order it belongs to.
      corporateUse: entitlement
        ? {
          companyId: entitlement.company.id,
          items: items.map((l) => ({ nameAr: l.nameAr, nameEn: l.nameEn, qty: l.qty })),
          percentOff: entitlement.percentOff,
          discountJod: totals.discount,
        }
        : null,
      // The second-visit voucher — «تانية علينا» (BRIEF §3 W2). The backend
      // evaluates it after the order is written and BEFORE the grant and the
      // spend: its guards read the member's PRE-transaction balance and window
      // (bff/test/secondVisit.test.ts T32a goes red if that order changes).
      // The arm comes from the member id, never from the request body: a
      // client that can choose its own arm is not a control arm.
      secondVisit: {
        basketHasDrink: hasDrink,
        arm: assignHoldout(id, holdoutSpecFromConfig('secondVisitVoucher')),
      },
      at: now,
    });
    // A failed voucher evaluation never fails a paid checkout — the backend
    // rolled back only the voucher (a savepoint) — but it must not be silent:
    // the member lost it permanently, because the next order is not their first.
    if (result.secondVisitError) {
      req.log.error({ err: result.secondVisitError }, 'second-visit voucher evaluation failed');
    }
    // Log the sold lines with calendar covariates (forecasting training data).
    // After the commit, so a refused checkout never trains the forecast.
    recordOrderLines({
      orderId: result.order.id, memberId: id, branchId: input.branchId,
      orderType: input.orderType, items,
    });
    return reply.code(201).send({
      orderId: result.order.id,
      subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
      itemCount: items.reduce((s, l) => s + l.qty, 0),
      pointsEarned: result.order.pointsEarned,
      pointsBalance: result.pointsBalance,
      walletBalance: toJod(result.walletBalanceFils),
      // null for a member who was suppressed, declined, ineligible or already
      // evaluated — the SAME bytes in every case, so the body cannot be read
      // to work out which arm the member is in.
      secondVisitVoucher: toSecondVisitView(result.secondVisitVoucher, now),
    });
  });
}
