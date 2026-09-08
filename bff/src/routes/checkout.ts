import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../validate';
import { requireMember, memberId } from '../plugins/auth';
import { idempotencyPreHandler, idempotencyOnSend } from '../plugins/idempotency';
import { reprice } from '../pricing';
import { computeEarn } from '../earn';
import { assignHoldout, holdoutSpecFromConfig, stampAllExperiments } from '@almond/shared/loyalty/holdout';
import { toSecondVisitView, type SecondVisitVoucherView } from '@almond/shared/loyalty/secondVisit';
import { liveBalance } from '@almond/shared/loyalty/lots';
import { toFils, toJod } from '../money';
import { recordOrderLines } from '../analytics/orderLines';
import type { Backend } from '../backend';

const bodySchema = z.object({
  branchId: z.string(),
  orderType: z.enum(['pickup', 'dinein', 'delivery']),
  paymentMethod: z.enum(['cash', 'cliq', 'visa', 'mastercard', 'paypal', 'wallet']),
  lines: z.array(z.object({
    itemId: z.string(),
    sizeId: z.enum(['S', 'M', 'L']),
    optionIds: z.array(z.string()).default([]),
    qty: z.number().int().positive(),
  })).min(1),
});

export function registerCheckoutRoutes(app: FastifyInstance, backend: Backend): void {
  app.post('/v1/checkout', {
    preHandler: [requireMember, idempotencyPreHandler],
    onSend: [idempotencyOnSend],
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
    const { items, totals, comboPairs, hasDrink } = reprice(input.lines);
    // One instant for this whole request. It dates the voucher's 30-day life,
    // which is an INSTANT and not a business day — Asia/Amman is UTC+3
    // year-round, so 30 × 86.4e6 ms is exactly 30 Amman calendar days. The
    // business-day machinery (ammanDayKey) still owns the DISPLAYED date.
    const now = new Date();
    const paidFromBalance = input.paymentMethod === 'wallet';

    // 2) Atomic saga with compensation.
    let walletDebited = 0;
    try {
      if (paidFromBalance) {
        // 🔴 THE ASSIGNMENT COMES AFTER THE AWAIT, AND THAT IS THE WHOLE POINT.
        //
        // It used to be `walletDebited = toFils(total)` on the line BEFORE the
        // debit. When debitWallet threw — an insufficient balance, the most
        // ordinary failure this route has — the catch below saw a non-zero
        // `walletDebited` and "compensated" by CREDITING money that had never
        // left the wallet. A member with 1 JOD who tried to buy a 5 JOD coffee
        // ended up with more money than they started with, every time they
        // tried. Found by T34f on 2026-09-08.
        //
        // A compensation variable must record what actually happened, never
        // what was about to be attempted.
        const fils = toFils(totals.total);
        await backend.debitWallet(id, fils); // throws → nothing below runs
        walletDebited = fils;
      }
      // NOTE: card/cliq payments would capture via a PSP here (out of scope).
      const order = await backend.createOrder({
        memberId: id, branchId: input.branchId, type: input.orderType,
        paymentMethod: input.paymentMethod,
        subtotal: totals.subtotal, tax: totals.tax, total: totals.total, pointsEarned: 0,
        // The experiment arms this member was in when the order was written
        // (§4.11's snapshot). RECORDED, NEVER ACTED ON HERE: nothing in this
        // route branches on an arm, and no field of the 201 body carries one —
        // a control arm that knows it is one is not a control arm.
        experimentArms: stampAllExperiments(id),
      });
      // Log the sold lines with calendar covariates (forecasting training data).
      recordOrderLines({
        orderId: order.id, memberId: id, branchId: input.branchId,
        orderType: input.orderType, items,
      });

      // 4) The second-visit voucher — «تانية علينا» (BRIEF §3 W2).
      //
      // 🔴 THIS RUNS BEFORE computeEarn/addPoints/recordSpend AND THAT IS
      // LOAD-BEARING. The backend reads the member's PRE-transaction balance to
      // decide eligibility (a balance the BFF never granted means a history it
      // cannot see — the guard against re-issuing to all 47,720 migrated
      // members). memory.ts's must() returns the stored Member and addPoints
      // mutates it in place, so moved below the grant this guard would read a
      // post-grant balance and NOBODY would ever be issued a voucher.
      // bff/test/secondVisit.test.ts T32a goes red the moment it moves.
      //
      // Wrapped so it can never fail a checkout that already took money: a
      // marketing grant must not roll back a paid order. The cost of that
      // trade — a swallowed error loses this member's voucher permanently,
      // because the next transaction is no longer their first — is accepted
      // here and removed properly in Odoo, where the row is written in the same
      // database transaction as the order.
      let secondVisitVoucher: SecondVisitVoucherView | null = null;
      try {
        const issued = await backend.evaluateSecondVisitVoucher({
          memberId: id,
          orderId: order.id,
          basketHasDrink: hasDrink,
          // The arm comes from the member id, never from the request body: a
          // client that can choose its own arm is not a control arm.
          arm: assignHoldout(id, holdoutSpecFromConfig('secondVisitVoucher')),
          at: now,
        });
        secondVisitVoucher = toSecondVisitView(issued, now);
      } catch (e) {
        req.log.error({ err: e }, 'second-visit voucher evaluation failed');
      }

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
      const earn = computeEarn({
        total: totals.total,          // tax-inclusive, per §1.1
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
      const pointsEarned = earn.points;
      // The whole breakdown is persisted on the order (§5b) so a grant can be
      // re-derived and the shadow delta reconstructed after the fact.
      await backend.recordEarnBreakdown(order.id, earn);
      const pointsBalance = await backend.addPoints(id, pointsEarned, 'نقاط طلب', 'Order points');
      // Dated and pruned to the rolling window — never `windowSpend += jod`.
      await backend.recordSpend(id, totals.total);
      const after = await backend.getMember(id);
      return reply.code(201).send({
        orderId: order.id,
        subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
        itemCount: items.reduce((s, l) => s + l.qty, 0),
        pointsEarned, pointsBalance, walletBalance: toJod(liveBalance(after.walletLots)),
        // null for a member who was suppressed, declined, ineligible or already
        // evaluated — the SAME bytes in every case, so the body cannot be read
        // to work out which arm the member is in.
        secondVisitVoucher,
      });
    } catch (err) {
      if (walletDebited > 0) {
        // 'refund', not 'topup': the member did not buy this money back, we are
        // returning it. The lot gets a fresh 24-month clock, which is the
        // generous side of an ambiguity nobody should have to lose sleep over.
        try { await backend.creditWallet(id, walletDebited, 'refund'); } catch { /* compensation best-effort */ }
      }
      throw err;
    }
  });
}
