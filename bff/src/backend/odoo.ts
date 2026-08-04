import type { Backend } from './types';

/** Odoo 19 adapter — production source of truth. Each method maps to an Odoo
 *  REST/JSON-RPC call (see docs/ODOO-INTEGRATION.md and IMPLEMENTATION-PLAYBOOK
 *  §2). Deliberately unimplemented so `DATA_SOURCE=odoo` fails loudly until wired.
 *
 *  Mapping (target):
 *   - findOrCreateByPhone → res.partner search/create keyed by normalized +962 phone
 *   - getMember          → res.partner + loyalty.card (points) + ewallet balance
 *   - debit/creditWallet → ewallet transaction (idempotent)
 *   - addPoints/spend    → loyalty.card update via loyalty.program/reward
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
    addPoints: () => todo('addPoints'),
    spendPoints: () => todo('spendPoints'),
    addSpend: () => todo('addSpend'),
    createOrder: () => todo('createOrder'),
    getHistory: () => todo('getHistory'),
    // Subscription → a recurring loyalty.program membership + sale.subscription.
    activateSubscription: () => todo('activateSubscription'),
    redeemSubscriptionDrink: () => todo('redeemSubscriptionDrink'),
    getSubscription: () => todo('getSubscription'),
  } as unknown as Backend;
}
