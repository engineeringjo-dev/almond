import type { Backend } from './types';

/** Odoo 19 adapter — production source of truth. Each method maps to an Odoo
 *  REST/JSON-RPC call (see docs/ODOO-INTEGRATION.md and IMPLEMENTATION-PLAYBOOK
 *  §2). Deliberately unimplemented so `DATA_SOURCE=odoo` fails loudly until wired.
 *
 *  Mapping (target):
 *   - findOrCreateByPhone → res.partner search/create keyed by normalized +962 phone
 *   - getMember          → res.partner + the LOT LEDGER (below) + ewallet balance
 *   - debit/creditWallet → ewallet transaction (idempotent)
 *   - addPoints/spend    → an INSERT and a FIFO walk over the lot table (below),
 *                          not a loyalty.card scalar
 *   - createOrder        → sale.order (or pos.order) confirm, idempotent
 *   - getHistory         → loyalty.history / points log
 */
export function createOdooBackend(): Backend {
  const todo = (name: string) => {
    throw new Error(`OdooBackend.${name} not implemented — wire Odoo 19 (see IMPLEMENTATION-PLAYBOOK §2)`);
  };
  return {
    findOrCreateByPhone: () => todo('findOrCreateByPhone'),
    getMember: () => todo('getMember'),
    debitWallet: () => todo('debitWallet'),
    creditWallet: () => todo('creditWallet'),
    // 🔴 THE POINT LEDGER IS A TABLE, NOT A COLUMN, for the same reason the
    // window is a bucket engine and not a scalar. Owner: «كل نقطة تعيش ١٢ شهر
    // ولا تتجدد بشراء جديد وصرف النقاط FIFO» and «لا إعفاء — القاعدة للجميع».
    //   almond_loyalty_lot(partner_id, seq, granted_on DATE, expires_on DATE,
    //     amount INT, remaining INT, source)
    //     UNIQUE(partner_id, seq); INDEX(partner_id, granted_on, seq)
    // Both DATE columns are AMMAN business days, decided by the writer and
    // never re-derived from a server's clock (pos.order.date_order in Amman,
    // not Odoo's UTC) — the enforced day and the day the app prints must be the
    // same day. `expires_on` is WRITTEN AT GRANT TIME, never computed on read:
    // a lot carries the promise it was issued under, so editing
    // POINT_LOT_LIFE_MONTHS can only affect grants made after the edit.
    //   addPoints   → one INSERT. It touches no existing row; a purchase
    //                 renews nothing.
    //   spendPoints → SELECT ... WHERE remaining > 0 AND expires_on >= today
    //                 ORDER BY granted_on, seq FOR UPDATE, then check the SUM
    //                 BEFORE the first UPDATE and decrement `remaining` only —
    //                 never `amount`, and never re-dating a partly-spent row.
    //   the balance → SUM(remaining) over that same predicate. Do NOT add a
    //                 cached scalar column: a second number is a second opinion.
    // 🔴 AND: the cutover needs a MIGRATION that turns each member's existing
    //   balance into ONE lot dated at the CUTOVER DAY (source 'migration', seq
    //   0), NOT at their last activity — a rule may not take money
    //   retroactively, and dating it at last activity kills most of the dormant
    //   tail on day one with no notice. That lot must NOT be written to the
    //   points history: `unexplainedPoints` is balance − Σ(history rows), and
    //   logging it would mark all 47,720 migrated members "explained" and
    //   disarm the second-visit guard below. *.odoo.com is unreachable from
    //   this environment, so like the backfill below this is a documented
    //   probe, and no test in this repo can enforce it.
    // ⚠ Cutover + 12 months is a CLIFF: every unredeemed migrated point dies on
    //   one calendar day. That is an owner decision, not a code one. See
    //   packages/shared/src/loyalty/lots.ts migrationLot for the storage-free
    //   jitter that would smear it, and the instruction not to ship it unasked.
    addPoints: () => todo('addPoints'),
    spendPoints: () => todo('spendPoints'),
    setProfile: () => todo('setProfile'),
    // The rolling window on the Odoo side is a BUCKET ENGINE, not a scalar:
    // recordSpend → an almond_loyalty.spend row dated by the Amman business day
    // (pos.order.date_order, not the server's), pruned/aggregated to
    // config.TIER_WINDOW_DAYS; getStanding → SUM(jod) and COUNT(DISTINCT day)
    // over that window combined with res.partner.almond_held_tier, which is the
    // FLOOR and may only ever be raised; evaluateTier → the quarterly cron
    // (Odoo gate 4) that stamps requalification and issues that quarter's
    // coupon. Listed by name so DATA_SOURCE=odoo fails loudly on the right
    // method instead of returning undefined through the cast below.
    recordSpend: () => todo('recordSpend'),
    getStanding: () => todo('getStanding'),
    evaluateTier: () => todo('evaluateTier'),
    createOrder: () => todo('createOrder'),
    // recordEarnBreakdown → the EarnBreakdown JSON on the sale.order / pos.order
    // record, which is what §5b's shadow analysis reads back.
    recordEarnBreakdown: () => todo('recordEarnBreakdown'),
    getHistory: () => todo('getHistory'),
    // The second-visit voucher maps to a `loyalty.card` on a `coupons`-type
    // loyalty.program, plus one table of our own:
    //   almond_loyalty_second_visit(partner_id, outcome, arm_json, issued_at,
    //     expires_at, order_id, redeemed_at, basket_had_drink)
    //   with UNIQUE(partner_id) — that constraint IS "one per member, ever",
    //   enforced by the database rather than by a read-then-write.
    // 🔴 The redemption must be the conditional UPDATE, not a SELECT then an
    //   UPDATE: `UPDATE … SET redeemed_at = now() WHERE id = %s AND
    //   redeemed_at IS NULL`, treating 0 ROWS AFFECTED as already-redeemed.
    //   That is the SQL form of the await-free compare-and-set in memory.ts.
    // 🔴 AND: enabling this in production requires a backfill that writes an
    //   'ineligible' row for every pre-existing member first. All 47,720 have
    //   zero orders in the BFF's log, so without the backfill each one's next
    //   drink is a "first identified transaction" — 19,040 JOD of material,
    //   silently, with nothing raising an error.
    // 🔴 AND: `unexplainedPoints` is the member's balance MINUS what this
    //   system granted them (in Odoo: minus the loyalty.history rows it owns).
    //   Passing the raw balance disqualifies every member who used a wallet
    //   top-up — the BFF's own bonus made them look migrated — permanently and
    //   with no error. See packages/shared/src/loyalty/secondVisit.ts and T32u.
    evaluateSecondVisitVoucher: () => todo('evaluateSecondVisitVoucher'),
    getSecondVisitVoucher: () => todo('getSecondVisitVoucher'),
    redeemSecondVisitVoucher: () => todo('redeemSecondVisitVoucher'),
    // Subscription → a recurring loyalty.program membership + sale.subscription.
    activateSubscription: () => todo('activateSubscription'),
    redeemSubscriptionDrink: () => todo('redeemSubscriptionDrink'),
    getSubscription: () => todo('getSubscription'),
  } as unknown as Backend;
}
