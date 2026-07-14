# Delivery integration — Ishbek → Careem / Talabat (design)

Goal (owner): customers order on **our** website/app; **Careem & Talabat captains
do the last‑mile delivery** via a **single integration with Ishbek**, which bridges
**Odoo** to both fleets. We own the customer and the order, and pay only for the
delivery leg — **cutting the marketplace commission** of ordering through Talabat/
Careem's own apps.

> This is the design + the code seam. Nothing calls live APIs while
> `DATA_SOURCE='mock'`; flip to `odoo` + set the Ishbek keys to go live.

## Architecture

```
 Web (almond-web) ┐
                  ├─► Odoo 19 (orders, menu, customers, loyalty)  ──►  Ishbek  ──►  Careem fleet
 App (almond-app) ┘            ▲  single source of truth                  │      └►  Talabat fleet
                               └──────────── webhooks (status) ◄──────────┘
```

- **One integration**: the website and app both write orders to **Odoo**. Odoo
  (via Ishbek) requests a driver from Careem or Talabat for `delivery` orders.
- **Ishbek** normalises both fleets behind one API: quote → dispatch → track →
  cancel, plus status webhooks (assigned / picked‑up / delivered).
- **Commission**: marketplace ordering charges a % of the basket; here we pay a
  **flat delivery fee** to the fleet, keeping menu margin + the customer
  relationship (and the loyalty points) with Almond.

## Order flow (delivery)

1. Customer builds the cart and chooses **Delivery**, enters an address.
2. Order is created in Odoo (same `Order` shape used today; `+ deliveryAddress`).
3. Odoo asks Ishbek for a **quote** (fee + ETA) for the branch → address.
4. On payment, Odoo calls Ishbek **dispatch**; Ishbek assigns a Careem/Talabat
   captain to pick up from the nearest branch.
5. Ishbek **webhooks** push status → Odoo → web/app live tracking.

## The contract (already scaffolded)

`@almond/shared/integration` gains a `delivery` system + Ishbek endpoints, and
the website has a `data/delivery.ts` service that returns a mock dispatch under
`mock` and will call Ishbek under `odoo` — **same return shapes**, so no UI
change when we go live:

```
enabled.delivery            // per-system switch
baseUrls.ishbek             // https://api.ishbek.com (set per env)
endpoints.deliveryQuote     // POST  fee + ETA for branch → address
endpoints.deliveryDispatch  // POST  assign a captain (Careem/Talabat)
endpoints.deliveryStatus    // GET   /:orderId live status
endpoints.deliveryCancel    // POST  cancel a dispatch
```

Auth: an Ishbek API key (`EXPO_PUBLIC_ISHBEK_KEY` / `NEXT_PUBLIC_ISHBEK_KEY`),
read the same way as the existing Odoo / loyalty tokens.

## To go live (checklist)

1. Get Ishbek credentials + confirm the Careem/Talabat fleet onboarding.
2. Implement the live `data/delivery.ts` methods against the endpoints above.
3. Map Ishbek status webhooks → order status in Odoo.
4. Flip `enabled.delivery` (or global `DATA_SOURCE`) to `odoo`.
5. Replace the temporary Talabat redirect with the in‑house dispatch (already
   wired in checkout behind the switch).
