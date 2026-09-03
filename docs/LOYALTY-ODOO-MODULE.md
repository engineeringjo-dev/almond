# Almond Loyalty — Odoo 19 capability boundary and the custom module

**Artifact:** `odoo-module` (Phase-0 kit, 1 of 5)
**Status:** specification. No code is shipped by this document. Nothing here touches production.
**Audience:** the developer who will type the module, and the reviewer who will gate it.
**Companions:** `BRIEF.md` (business numbers), `IMPL-BRIEF.md` (environment, established defects),
`tools/loyalty_audit_live.py` (read-only live audit), `tools/loyalty_measure.py`, `tools/loyalty_fraud_scan.py`.

---

## 0. How to read this document, and what it is allowed to claim

This document makes three kinds of statement, and they are marked differently everywhere:

| Marker | Meaning |
|---|---|
| **[STOCK]** | A claim about Odoo 19's `loyalty` / `pos_loyalty` addons. Written from the addon design, **not** from the live database. Every field named this way appears in the probe manifest in §9 and **must be confirmed by introspection before a line of code depends on it.** |
| **[MEASURE]** | A number that does not exist yet and cannot be invented. The document names the instrument that produces it. |
| **[BUDGET]** | A performance target this design *imposes on itself*, not an observation. Every budget has a measurement hook so it can later be confirmed or refuted. |
| **[ASSUMPTION]** | A stated guess, with its sensitivity. |
| **[DECISION]** | A design choice made here, with its reason and its cost. |

There is exactly one rule behind all of this: **no observed value is invented.** Where the design
needs a production number — member coverage, redemption rate, POS timing, availability — the
document specifies what measures it rather than asserting it.

A second rule, from `IMPL-BRIEF.md` §"Environment facts": Odoo is **not reachable from the dev
container** (the egress proxy 403s `*.odoo.com`). Nothing in this specification may be validated
from here. The probe in §9 runs elsewhere, exactly like `tools/loyalty_audit_live.py`.

---

## 1. What Odoo 19's loyalty engine actually is

Before the capability table, the shape of the thing — because most of the CUSTOM rows below follow
directly from three structural facts, not from missing fields.

### 1.1 The five models

```
loyalty.program   ── the container. program_type, applies_on, trigger, date_from/date_to,
   │                 pos_ok / sale_ok, pos_config_ids, limit_usage / max_usage,
   │                 portal_visible / portal_point_name, communication_plan_ids
   ├── loyalty.rule    ── how points are EARNED. One rule = one earning clause.
   │                     reward_point_mode ∈ {order, money, unit}, reward_point_amount,
   │                     minimum_amount + minimum_amount_tax_mode, minimum_qty,
   │                     product_ids / product_category_id / product_tag_id / product_domain,
   │                     mode ∈ {auto, with_code}, code
   └── loyalty.reward  ── what points BUY. reward_type ∈ {product, discount},
                         required_points, discount + discount_mode ∈ {percent, per_point, per_order},
                         discount_applicability ∈ {order, cheapest, specific},
                         reward_product_id(s), reward_product_qty, discount_max_amount, active

loyalty.card      ── one partner's balance in one program. points, code, expiration_date, use_count
loyalty.history   ── the ledger. card_id, issued, used, description, + an order back-reference
                     whose SHAPE CHANGED between 16 and 17 (see §8) — probe it, do not assume.
```

All of the above is **[STOCK]**.

### 1.2 Structural fact #1 — a rule is a function of the ORDER, never of the CUSTOMER

`loyalty.rule` filters on products, categories, tags, quantities and amounts. It has no partner
input at all. `loyalty.program` restricts by POS config, by date range, by usage count — never by
who the customer is.

Consequence: **every customer-dependent mechanism is CUSTOM.** Tier multipliers, tier-gated rewards,
control-group holdout, birthday, welcome credit, fast-track — all of them fail on this one fact,
not on a missing convenience field.

> **The stock-only workaround, and why it is rejected.** `loyalty.program` has `pricelist_ids`
> **[STOCK, probe]**. A partner carries a pricelist. So three parallel programs, each restricted to
> the pricelist of one tier, *would* express tier multipliers with zero custom code.
> **[DECISION] Rejected.** It (a) hijacks pricing — a loyalty tier would silently become a price
> list, and Almond's whole position is a *no-discount* culture at 1.5–2% of sales (BRIEF §1);
> (b) triples the number of programs the POS front end evaluates on **every** order line change,
> spending the §6 latency budget on a workaround; (c) makes tier changes a pricing migration.
> It is recorded here so a reviewer does not propose it as a discovery.

### 1.3 Structural fact #2 — rules within a program are OR, not AND

Each `loyalty.rule` that matches an order issues its own points. Two rules do not compose into a
conjunction. So "one drink **and** one food item in the same basket" — the combo bonus the owner
wants kept (BRIEF §5) — is not expressible as two rules. It is CUSTOM.

### 1.4 Structural fact #3 — POS computes points in the browser

`pos_loyalty` loads programs, rules and rewards into the POS client and computes earn and claimable
rewards **client-side**, in JS, as the order changes. The server re-derives on order save.

Two consequences, and they dominate §6 and §7:

1. **Offline earn works by construction.** Nothing needs to be built for it. What needs to be built
   is the *reconciliation* (§7).
2. **Any custom multiplier must exist on both sides.** If it exists only in Python, the receipt shows
   one number and the ledger holds another. That is defect **D2** from `IMPL-BRIEF.md` — client/server
   earn divergence — reproduced inside Odoo. §4.2 specifies the single-source-of-parameters discipline
   that prevents it, and §7.4 specifies what happens when it fails anyway.

---

## 2. Capability table

Read the middle column as: *"if you tried to build this with stock Odoo 19 alone, this is the
mechanism you would reach for, and this is where it stops."*

| # | Mechanism | Stock Odoo 19? | The stock mechanism, and where it stops |
|---|---|---|---|
| 1 | **Base earn per JOD** | **YES — fully** | `loyalty.program(program_type='loyalty')` + `loyalty.rule(reward_point_mode='money', reward_point_amount=5)`. One rule, no code. **The 8%/16% tax question lands exactly here**: `loyalty.rule.minimum_amount_tax_mode` ∈ `{incl, excl}` **[STOCK, probe]** and the basis on which `money` is evaluated decide whether 5 pts/JOD is 5% of gross or of net. That is a 7–15% swing on total program cost (BRIEF §5). Do not pick it silently — §9 probes what the live program does today. |
| 2 | **Tier multipliers** (×1.0 / ×1.25 / ×1.5 …) | **NO — CUSTOM** | Fails on §1.2: no partner input on any rule. Pricelist trick rejected (§1.2). → **§4.1, §4.2** |
| 3 | **Rolling-window tier qualification** (spend over last N days) | **NO — CUSTOM** | Stock has no tier concept, no window, no aggregate. `loyalty.card.points` is a *balance*, not a *qualification*, and spending points would demote you — which is the wrong semantics entirely. → **§4.1, §5** |
| 4 | **Demotion with one-step + grace** | **NO — CUSTOM** | Follows #3. Note this is where Starbucks 2019 lost the argument publicly (BRIEF §4): demotion mechanics are a communications artefact as much as a code artefact. → **§4.1, §5.5** |
| 5 | **Visit-based fast-track** (e.g. 12 visits/30 d ⇒ Silver) | **NO — CUSTOM** | Needs a *second* rolling window of a different length over the same event stream. Free once #3's structure exists (§5.4), impossible without it. → **§5.4** |
| 6 | **Redemption ladder, fixed-point rungs** | **YES — fully** | One `loyalty.reward` per rung: `reward_type='product'`, `required_points=100/250/400…`, `reward_product_id`. Caribou's 8 rungs (25→400) map 1:1. **This is the single thing stock does really well** — and the proposal's most important idea (a 100-point first rung, PROPOSAL §) needs no code at all. |
| 6b | **Cash-value redemption** (100 pts = 1 JOD off) | **YES — fully** | `reward_type='discount'`, `discount_mode='per_point'`, `discount=0.01`, `discount_applicability='order'`. Stock supports it. Whether Almond *should* is a live disagreement (BRIEF §5) — out of scope for this artifact, but note the capability is not the constraint. |
| 7 | **Cost-based reward pricing** (rungs priced by COGS, not menu price) | **NO — CUSTOM (process, not field)** | `required_points` is a float you type. Nothing derives it from `product.standard_price`. And auto-repricing is *dangerous*: silent devaluation is precisely what broke Dunkin' in 2022 (BRIEF §4). → **§4.5** (propose-only cron + human apply) |
| 8 | **Availability-gated rewards** (hide a reward when the item is out) | **NO — CUSTOM, and the signal itself must be MEASURED** | `loyalty.reward.active` is a manual switch; nothing watches stock. Worse: Almond's items are largely non-storable, so `qty_available` is meaningless for a latte. **There is no stock availability signal for a coffee product.** → **§4.6** |
| 9 | **Off-peak-only rewards** (free drink 14:00–16:00) | **NO — CUSTOM** | `loyalty.program.date_from/date_to` are **dates**, not times of day, and they gate the whole program, not one reward. No day-of-week mask, no hour range, anywhere. → **§4.4** |
| 10 | **Channel differential** (in-store vs delivery) | **PARTIAL — see the finding** | Stock gives `program.pos_ok` / `sale_ok` / `pos_config_ids`, which separates *POS* from *sales orders*. That is enough for in-store vs own-app delivery. **But the real finding is upstream:** the 23% of payment value arriving via Talabat/Careem's own apps (BRIEF §1) carries **no customer identity at all** — it is structurally unearnable, not merely unimplemented. Own-app delivery via Ishbek (`docs/DELIVERY-INTEGRATION.md`) lands as a sale order and *is* addressable. → **§4.7** |
| 11 | **Combo bonus** (drink + food in one basket) | **NO — CUSTOM** | Fails on §1.3: rules are OR'd; there is no conjunction operator. Also note defect **D4** — in the repo's own implementation the combo bonus is added *after* the cap and escapes it. The Odoo implementation must place it *inside* the cap (#15). → **§4.3** |
| 12 | **Points expiry with notice** | **PARTIAL → CUSTOM** | `loyalty.card.expiration_date` **[STOCK, probe]** expires **the entire card**, on one date, with no notice and no tranches. It cannot express "points earned in January expire next January while December's live on". And it is a *trap*: if anyone ever sets it, stock zeroes the balance behind the custom ledger's back (§8). Also fixes defect **D5** (expiry currently inverted: the largest balances never expire). → **§4.8** |
| 13 | **Welcome / head-start credit** | **CUSTOM-LITE** | No stock "first order only" rule. But no new model is needed either: create the `loyalty.card` with a non-zero `points` at enrolment and write one `loyalty.history` row. The only real work is **idempotency** — one grant per partner, ever, including across an offline sync. → **§4.9** |
| 14 | **Birthday reward** | **CUSTOM (cron) over stock storage** | `communication_plan_ids` fires on *program* events, not on the calendar. But the issuance itself is stock: a `coupons`-type program plus a daily cron that creates cards. Note `res.partner` has **no birthday field** in stock — one must be added, and §4.10 argues for month+day only. |
| 15 | **Per-invoice point cap** | **NO — CUSTOM** | `limit_usage` / `max_usage` count *program usages*, not points. There is no per-order point ceiling anywhere. This is the field defect **D1** was supposed to be (`MAX_EARN_MULTIPLIER=5` is dead code: max reachable stack is 18.75× against a 25× cap). The Odoo cap must be **reachable by construction** — §4.3 makes it a hard clamp applied last, with the combo bonus *inside* it. |
| 16 | **Control-group holdout** (10% earn nothing, measured) | **NO — CUSTOM** | Fails on §1.2. And the naive implementation — a random boolean — is wrong for a different reason: it is not reproducible, not auditable, and re-randomises as partners are created. → **§4.11** (deterministic hash, snapshotted onto the order) |

**Score: 3 of 16 fully stock (#1, #6, #6b), 2 partial (#10, #12), 1 custom-lite (#13), 10 fully custom.**
The programme is not "Odoo loyalty with a few extras". It is a custom loyalty engine that *borrows*
Odoo's issuance, ledger and POS redemption plumbing. Budget accordingly.

---

## 3. The module

```
integrations/almond_loyalty/
├── __manifest__.py
├── __init__.py
├── hooks.py                        # post_init: assert stock surface, seed tiers, backfill window
├── models/
│   ├── __init__.py
│   ├── almond_loyalty_tier.py      # NEW  almond.loyalty.tier
│   ├── almond_loyalty_timewindow.py# NEW  almond.loyalty.timewindow
│   ├── almond_loyalty_bucket.py    # NEW  almond.loyalty.window.bucket      (§5)
│   ├── almond_loyalty_lot.py       # NEW  almond.loyalty.point.lot          (§4.8)
│   ├── almond_loyalty_availability.py # NEW almond.loyalty.availability     (§4.6)
│   ├── res_partner.py              # INHERIT  tier, window aggregates, holdout, birthday
│   ├── loyalty_program.py          # INHERIT  tier/channel/off-peak/holdout/cap gates
│   ├── loyalty_reward.py           # INHERIT  tier/off-peak/availability/cost-basis
│   ├── loyalty_card.py             # INHERIT  expiration_date guard (§8)
│   ├── pos_order.py                # INHERIT  earn snapshot + idempotency + divergence
│   ├── sale_order.py               # INHERIT  own-app delivery channel (§4.7)
│   └── pos_data_loading.py         # ⚠ ALL POS data-loading overrides live HERE ONLY (§8)
├── services/
│   ├── __init__.py
│   ├── earn.py                     # THE formula. One function. Server side of §4.2.
│   └── window.py                   # The rolling-window engine (§5)
├── data/
│   ├── ir_cron.xml                 # six crons (§4.12)
│   ├── almond_loyalty_tier_data.xml
│   └── mail_template_expiry.xml
├── security/
│   ├── almond_loyalty_security.xml # privilege + 3 groups + record rules
│   └── ir.model.access.csv
├── views/
│   ├── almond_loyalty_tier_views.xml
│   ├── loyalty_program_views.xml
│   ├── loyalty_reward_views.xml
│   ├── res_partner_views.xml
│   └── almond_loyalty_menus.xml
├── static/src/app/
│   ├── patches.js                  # ⚠ EVERY patched stock symbol is listed here (§8)
│   ├── earn_formula.js             # THE formula, client side. Mirror of services/earn.py.
│   └── loyalty_badge.xml           # our own OWL component (added, not overridden)
└── README.md
```

`__manifest__.py`, following `integrations/almond_branch/__manifest__.py` exactly:

```python
{
    'name': "Almond Loyalty (tiers, windows, gated rewards)",
    'version': '19.0.1.0.0',
    'category': 'Sales/Point of Sale',
    'summary': "Customer-dependent loyalty: tiers on a rolling window, gated rewards, FIFO expiry",
    'author': "Almond",
    'license': 'LGPL-3',
    'depends': ['point_of_sale', 'loyalty', 'pos_loyalty', 'almond_branch'],
    'data': [
        'security/almond_loyalty_security.xml',
        'security/ir.model.access.csv',
        'data/almond_loyalty_tier_data.xml',
        'data/mail_template_expiry.xml',
        'data/ir_cron.xml',
        'views/almond_loyalty_tier_views.xml',
        'views/loyalty_program_views.xml',
        'views/loyalty_reward_views.xml',
        'views/res_partner_views.xml',
        'views/almond_loyalty_menus.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'almond_loyalty/static/src/app/**/*',
        ],
    },
    'post_init_hook': 'post_init_almond_loyalty',
    'application': False,
    'installable': True,
    'auto_install': False,
}
```

`almond_branch` is a dependency because the branch dimension (`almond.branch`, and the stored
`pos.order.branch_id`) is what makes per-branch loyalty reporting and the §4.6 availability proxy
one indexed column instead of a join through `pos.config`.

---

## 4. The CUSTOM rows, specified

### 4.1 `almond.loyalty.tier` — the tier definition (rows #2, #3, #4, #5)

```python
class AlmondLoyaltyTier(models.Model):
    _name = 'almond.loyalty.tier'
    _description = 'Loyalty tier'
    _order = 'sequence, id'

    name          = fields.Char(required=True, translate=True)      # عضو / فضّي / ذهبي
    code          = fields.Char(required=True)                      # member / silver / gold
    sequence      = fields.Integer(required=True, default=10)       # strictly increasing with rank
    earn_multiplier = fields.Float(digits=(16, 3), default=1.0, required=True)
    qualify_spend = fields.Monetary(currency_field='currency_id')   # rolling-window net spend
    qualify_visits= fields.Integer()                                # fast-track: visits in FT window
    company_id    = fields.Many2one('res.company', required=True, index=True,
                                    default=lambda self: self.env.company)
    currency_id   = fields.Many2one(related='company_id.currency_id', readonly=True)
    color         = fields.Char()
    active        = fields.Boolean(default=True)

    _unique_code_company = models.Constraint(
        'UNIQUE(code, company_id)', 'A tier with this code already exists for this company.')
```

Two `@api.constrains` that are not optional:

* **Monotonicity.** `sequence`, `qualify_spend` and `earn_multiplier` must all rank in the same
  order. A tier that costs more to reach and pays less is a support incident, not a config choice.
* **Multiplier ceiling.** `earn_multiplier` must not exceed a module-level `MAX_TIER_MULTIPLIER`
  constant. This is the guard that defect **D1** failed to be: a ceiling that cannot be reached is
  not a ceiling. Set it to a value the tier ramp actually approaches, and make exceeding it an error
  at configuration time, not a silent clamp at earn time.

**Fields added to `res.partner`** (`models/res_partner.py`):

| Field | Type | Written by | Gated to |
|---|---|---|---|
| `almond_tier_id` | M2o `almond.loyalty.tier`, `index=True` | recompute service (sudo) **only** | `groups='almond_loyalty.group_almond_loyalty_manager'` |
| `almond_tier_pending_id` | M2o | recompute service | manager |
| `almond_tier_since` | Date | recompute service | manager |
| `almond_tier_grace_until` | Date | recompute service | manager |
| `almond_tier_multiplier` | Float, **stored compute, no inverse**, `depends=['almond_tier_id.earn_multiplier']` | ORM compute | ungated — POS reads this |
| `almond_tier_name` | Char, **stored compute, no inverse** | ORM compute | ungated — POS displays this |
| `almond_window_spend` | Monetary, `index=True` | §5 raw SQL | manager + auditor |
| `almond_window_visits` | Integer | §5 raw SQL | manager + auditor |
| `almond_ft_visits` | Integer | §5 raw SQL | manager + auditor |
| `almond_holdout` | Boolean, `index=True` | assigned once (§4.11) | manager + auditor |
| `almond_welcome_granted` | Boolean | §4.9 | manager |
| `almond_birth_month` / `almond_birth_day` | Integer | customer / staff | user |

> **Why the multiplier is a stored compute with no inverse, and this matters.**
> A stored computed field without an inverse **raises on `write()`**. That is ORM-level write
> protection with no record rule, no override and no `sudo()` audit hole. The cashier's POS session
> can *read* `almond_tier_multiplier` (it must — §6) and cannot possibly *write* it. Cashier
> self-promotion, which BRIEF §2.5 names as the live fraud vector, is closed by the field
> declaration itself rather than by a policy someone has to remember.
>
> The `groups=` attribute on `almond_tier_id` hides the field entirely (read included) from
> non-managers. That is why POS gets `almond_tier_name` and `almond_tier_multiplier` as separate
> ungated computes: the till needs the *number* and the *label*, never the *record*.

### 4.2 The earn formula — one definition, two evaluators (row #2)

This is the section that decides whether defect **D2** recurs.

**[DECISION] The arithmetic is duplicated (it must be — §1.4 requires it in the browser for offline).
The *parameters* are not duplicated. Not one of them.**

Every input to the formula is a **field on a record the POS already loads**:

| Input | Where it lives | How POS gets it |
|---|---|---|
| points per JOD | `loyalty.rule.reward_point_amount` | stock POS load |
| tax basis | `loyalty.rule.minimum_amount_tax_mode` | stock POS load |
| tier multiplier | `res.partner.almond_tier_multiplier` | `pos_data_loading.py` |
| per-invoice cap | `loyalty.program.almond_per_invoice_point_cap` | `pos_data_loading.py` |
| combo bonus | `loyalty.program.almond_combo_points` | `pos_data_loading.py` |
| holdout | **not loaded** — server-only (§4.11) | — |

`services/earn.py` and `static/src/app/earn_formula.js` implement the same five lines in the same
order, and the order is load-bearing:

```
base      = amount_on_tax_basis * points_per_jod
tiered    = base * tier_multiplier
combo     = combo_points * combo_pairs(lines)      # INSIDE the cap — fixes D4
subtotal  = tiered + combo
total     = min(subtotal, per_invoice_cap)         # LAST. Nothing is added after this line.
```

Three rules the reviewer should enforce on this file pair:

1. **Nothing is added after `min()`.** Defect **D4** is exactly one misplaced line; the cap must be
   the terminal operation in both files, and a test must assert `earn(huge order) == cap`.
2. **No date arithmetic anywhere in the formula.** Defect **D3** — a hardcoded Friday `+50%` living
   in no config, unturnoffable from admin — happened because a *day of week* got into the earn path
   as a literal. Day-of-week promotions belong in `loyalty.program` records with real date ranges,
   or in the §4.4 time-window model, never in the formula. A grep for `getDay`/`weekday` in this
   module should return nothing.
3. **A golden-vector test file shared by both.** A JSON fixture of ~30 (inputs → expected points)
   cases, loaded by the Python test and by the JS test. If the two implementations drift, CI fails
   before a customer notices. This is the only structural defence that survives a refactor.

### 4.3 Combo bonus and per-invoice cap (rows #11, #15)

**`loyalty.program` inherits:**

```python
almond_combo_points      = fields.Float(digits=(16, 2), default=0.0)
almond_combo_drink_tag_id= fields.Many2one('product.tag')
almond_combo_food_tag_id = fields.Many2one('product.tag')
almond_per_invoice_point_cap = fields.Float(digits=(16, 2), default=0.0)  # 0 = no cap
```

`combo_pairs(lines) = min(Σqty of drink-tagged lines, Σqty of food-tagged lines)` — the same
definition as `packages/shared/src/lib/combo.ts`, which is the existing single source of truth for
the web and app. Using **product tags** rather than category-name string matching is the one
improvement over the TS version: `categoryKind` classifies by category *name*, which breaks the day
someone renames a category in the live Talabat menu.

The cap is `Float`, not `Integer`, and `0.0` means "no cap" rather than "cap at zero" — with a
`@api.constrains` refusing a negative value, and a UI help string that says so, because "0 = off" is
the kind of convention that silently zeroes a programme.

### 4.4 Off-peak windows (row #9)

```python
class AlmondLoyaltyTimewindow(models.Model):
    _name = 'almond.loyalty.timewindow'
    _description = 'Time-of-day window (off-peak gating)'

    name      = fields.Char(required=True)
    dow_mask  = fields.Integer(required=True, default=127)  # bit 0 = Monday … bit 6 = Sunday
    hour_from = fields.Float(required=True)                 # 14.0 = 14:00, POS-style float hours
    hour_to   = fields.Float(required=True)                 # 16.5 = 16:30
    tz        = fields.Char(required=True, default='Asia/Amman')
    company_id= fields.Many2one('res.company', index=True)
```

Attached to both `loyalty.program.almond_timewindow_ids` and `loyalty.reward.almond_timewindow_ids`
(M2M; empty = always). Evaluated **client-side** in POS against the till's clock — a server round
trip to ask "is it off-peak?" would spend the §6 budget on a question the browser can answer in
microseconds — and **re-evaluated server-side on order confirm** as the authority.

Two things a reviewer must check:

* **`dow_mask` bit 0 is Monday**, matching Python's `weekday()`, and JS's `getDay()` is
  **Sunday-based**. That off-by-one between the two evaluators is the single most likely bug in this
  model. Convert once, in a named helper, in both files. Jordan's weekend is **Fri–Sat** (BRIEF §1),
  so the mask that means "weekend" is not the one a European reviewer expects.
* **Ramadan** shifts demand to post-sunset (BRIEF §1). A fixed 14:00–16:00 off-peak window is
  actively wrong for ~30 days a year. Either the windows get seasonal records with date bounds, or
  someone edits them each Ramadan and that expectation is written in the README. Do not leave this
  implicit.

### 4.5 Cost-based reward pricing (row #7)

```python
# loyalty.reward inherits
almond_cost_basis  = fields.Selection([('manual','Manual'),('cost','From product cost')],
                                      default='manual', required=True)
almond_cost_markup = fields.Float(default=1.0)      # points = cost_in_qirsh * markup
almond_cost_price  = fields.Monetary(compute='_compute_almond_cost_price', store=True)
almond_points_proposed = fields.Float(readonly=True) # what the cron THINKS it should be
almond_points_variance = fields.Float(compute='_compute_variance')  # proposed vs required_points
```

`almond_cost_price` derives from `reward_product_id.standard_price` — and the proposal's claim that
a size upgrade "costs 0.00" is false (BRIEF §2, review point 4: bigger cup + milk/shot ≈ 0.10–0.25
JOD). **[MEASURE]** The true marginal cost of each rung comes from `product.standard_price` on the
live database and is read by `tools/loyalty_measure.py`; this module must not carry a hardcoded cost
for any reward.

**[DECISION] The cron proposes; a human applies.** `cron_reward_repricing` (weekly) writes
`almond_points_proposed` and never touches `required_points`. A manager opens a list view sorted by
`almond_points_variance` and applies changes deliberately. Rationale: Dunkin' 2022 hid a 25%
devaluation behind a bigger number and paid for it publicly (BRIEF §4); Starbucks took two days of
backlash for a rate cut in 2026. An automatic repricing cron is a machine for generating that
incident on a schedule. Every applied change writes a row to a `almond.loyalty.reprice.log` audit
model (reward, old points, new points, user, date) so the programme's devaluation history is
answerable in one query.

### 4.6 Availability-gated rewards (row #8) — and the honest problem

The proposal wants items below 80% availability excluded from the catalogue. **There is no stock
availability signal for a non-storable coffee product.** `qty_available` on a consumable is
meaningless. This is a real gap, not a lookup.

**The authoritative fix (build this):** a cashier-facing "86" control. `product.template` gains
`almond_86_until` (Datetime) and `almond_86_by` (M2o `res.users`), set from a POS button and cleared
automatically. A reward whose `reward_product_id` is 86'd is hidden. This is a small, exact, honest
signal — and it is worth building for the kitchen anyway.

**The interim proxy (until the 86 button exists), and it is explicitly a proxy:**

```python
class AlmondLoyaltyAvailability(models.Model):
    _name = 'almond.loyalty.availability'
    _description = 'Measured sell-through proxy for product availability'

    product_id  = fields.Many2one('product.product', required=True, index=True)
    branch_id   = fields.Many2one('almond.branch', required=True, index=True)
    window_days = fields.Integer(required=True)
    days_open   = fields.Integer()      # branch-days with ANY order (= branch was trading)
    days_sold   = fields.Integer()      # branch-days with ≥1 line of this product
    availability_pct = fields.Float(compute='_compute_pct', store=True)
    last_computed    = fields.Datetime()
```

Filled by `cron_reward_availability` with one grouped SQL pass over `pos_order_line` joined to
`pos_order` on `branch_id` — the same shape as §5's bucket fill, and the reason `almond_branch` is a
dependency.

> **[MEASURE] and a warning the reviewer must not let through unchallenged.** This proxy conflates
> *out of stock* with *nobody ordered it*. A genuinely unpopular item reads as unavailable. It is
> acceptable only as a **floor** — it can hide a reward, it must never be the only reason a reward
> exists — and it must be labelled as a proxy in the UI help text. The number it produces is
> measured from production; the *interpretation* is an assumption.

`loyalty.reward.almond_reward_available` is a **stored** Boolean written by the cron, not a
non-stored compute — because POS loads reward records into the browser and a non-stored compute
would either not travel or would force a round trip per reward per order. Stored means the offline
client has a value that is at worst `cron_interval` old. **[DECISION]** Run that cron every 30
minutes and accept up to 30 minutes of staleness, rather than every 5 minutes and pay for a POS data
reload cascade eight times an hour across eight branches.

### 4.7 Channel differential (row #10)

```python
# loyalty.program inherits
almond_channel = fields.Selection([('any','Any'), ('instore','In-store'),
                                   ('delivery','Own-app delivery')], default='any', required=True)
# pos.order / sale.order inherit
almond_channel = fields.Selection(...)  # snapshotted at confirm, indexed
```

Three channels, and they are not symmetric:

1. **In-store POS** — `pos.order`. Fully addressable. Stock `program.pos_ok` + `pos_config_ids`
   already restricts a program to POS.
2. **Own-app delivery via Ishbek** — lands in Odoo as a sale order
   (`docs/DELIVERY-INTEGRATION.md`: the customer orders on Almond's app/site, Ishbek dispatches a
   Careem/Talabat captain). Customer identity is present. Fully addressable via `program.sale_ok`.
3. **Marketplace orders inside Talabat's / Careem's own apps** — **23% of payment value** (BRIEF §1).
   **These carry no customer identity that reaches Odoo.** They are not "not yet implemented"; they
   are structurally unearnable without the marketplace handing over a customer key, which it will not
   do because the customer is *its* asset, not Almond's.

**This reframes the strategy.** Kudu's 20 pts/SAR in-store vs 10 for delivery (BRIEF §4) is a
*deliberate* differential between two channels you own. Almond's situation is different: the
differential is between "channels we own" and "a fifth of revenue we cannot see". The loyalty
programme's channel lever is therefore not primarily a discount dial — it is the *reason* to move
customers off the marketplaces onto the own-app delivery path, which is exactly what the Ishbek
integration exists to do. Point that out in the design artifact; do not spend module complexity
trying to earn on marketplace orders.

### 4.8 FIFO point lots — expiry with notice (row #12), fixing D5

```python
class AlmondLoyaltyPointLot(models.Model):
    _name = 'almond.loyalty.point.lot'
    _description = 'A dated tranche of issued points (FIFO expiry)'
    _order = 'expiry_date, issue_date, id'

    card_id     = fields.Many2one('loyalty.card', required=True, index=True, ondelete='cascade')
    partner_id  = fields.Many2one(related='card_id.partner_id', store=True, index=True)
    program_id  = fields.Many2one(related='card_id.program_id', store=True, index=True)
    points_issued   = fields.Float(required=True)
    points_consumed = fields.Float(default=0.0)
    points_remaining= fields.Float(compute='_compute_remaining', store=True)
    issue_date  = fields.Date(required=True, index=True)
    expiry_date = fields.Date(required=True, index=True)
    state       = fields.Selection([('open','Open'),('spent','Spent'),
                                    ('expired','Expired'),('quarantined','Quarantined')],
                                   default='open', required=True, index=True)
    history_id  = fields.Many2one('loyalty.history', ondelete='set null')
    pos_order_uuid = fields.Char(index=True)     # the idempotency key — see §7
    notice_30_sent = fields.Boolean(default=False)
    notice_7_sent  = fields.Boolean(default=False)

    _uniq_issue = models.Constraint(
        'UNIQUE NULLS NOT DISTINCT (pos_order_uuid, program_id)',
        'Points for this POS order and program have already been issued.')
    _lot_expiry_idx = models.Index('(state, expiry_date) WHERE state = \'open\'')
```

The unique constraint is the whole of §7's double-issue defence and is discussed there. The partial
index is what makes the nightly expiry sweep touch only open lots.

**Consumption is FIFO by `expiry_date`** — oldest-expiring first, which is the customer-favourable
order and the only one that does not create an arbitrage where a customer's points expire while
newer ones sit unspent. Hooked on redemption confirm (§6.3).

**`cron_expire_points`** (daily, 00:10 UTC = 03:10 Amman): for lots with `state='open'` and
`expiry_date <= today`, write a negative `loyalty.history` row, decrement `loyalty.card.points`,
set `state='expired'`. One grouped pass, not a per-partner loop.

**`cron_expiry_notice`** (daily, 05:00 UTC = 08:00 Amman — a civil hour to push a notification):
lots expiring in 30 and in 7 days, with the `notice_*_sent` flags as idempotency so a cron retry
does not double-notify. Notification goes out through the BFF push path and a mail template.

> **This fixes defect D5, and the fix is the point.** The repo currently expires Bean/Silver in 12
> months and Gold/Black **never** — so the largest balances are a permanent, unbounded liability.
> Lots make expiry uniform and *per-tranche*, which is both the standard practice (Dutch Bros: 180
> days flat, BRIEF §4) and the only structure in which the liability number is computable at all.
> `tools/loyalty_measure.py` computes the liability; this model is what makes its answer stable.

### 4.9 Welcome / head-start credit (row #13)

No new model. On enrolment, create the `loyalty.card` with `points = WELCOME_POINTS`, write one
`almond.loyalty.point.lot`, and set `res.partner.almond_welcome_granted = True` **in the same
transaction**. The boolean plus a `UNIQUE(partner_id) WHERE program_id = welcome_program` partial
index is the idempotency. `cron_welcome_sweep` (hourly) catches partners created by code paths that
bypassed the hook — imports, the BFF, an offline enrolment — and is a no-op once nothing is found,
following the retiring-janitor pattern in `almond_followers_guard/models/mail_followers.py`.

The endowed-progress effect the repo already uses on the stamp card (`CUP_HEAD_START: 1`) is the
same psychology and is well chosen; this just makes the points version idempotent.

### 4.10 Birthday reward (row #14)

`res.partner` gains **`almond_birth_month` and `almond_birth_day` as two Integers — not a Date.**

**[DECISION]** Storing month+day only: the reward needs nothing else; it removes the birth year from
the database entirely, which removes age inference, which removes a category of PII exposure from a
customer table that eight branches' worth of staff can query. It also sidesteps 29 February. The
cost is that "age" is unavailable for segmentation — state that trade-off in the README rather than
letting someone quietly add the year back later.

`cron_birthday_grant` (daily, 04:00 UTC): for partners matching today's month/day, not in the
holdout, not already granted this calendar year, create a `loyalty.card` on a `coupons`-type
program with an expiry of ~14 days. Idempotency: `almond.loyalty.birthday.grant(partner_id, year)`
with `UNIQUE(partner_id, year)`. Cheap table, exact semantics, survives a cron retry and a restore.

### 4.11 Control-group holdout (row #16)

**[DECISION] Deterministic, not random.**

```python
def _almond_holdout(partner_id, salt, pct):
    digest = hashlib.sha256(f"{partner_id}:{salt}".encode()).digest()
    return (int.from_bytes(digest[:4], 'big') % 100) < pct
```

`salt` and `pct` live in `ir.config_parameter` (`almond_loyalty.holdout_salt`,
`almond_loyalty.holdout_pct`). Three properties a random boolean does not have:

* **Reproducible.** The analyst can recompute assignment from partner ids alone, months later,
  without trusting a mutable column.
* **Stable under growth.** Partners created next month land in the holdout at the same rate with no
  re-randomisation and no drift in the control group's composition.
* **Auditable.** Changing the salt is a visible config change, not an invisible reshuffle. A test
  should assert that changing the salt reassigns roughly `pct` of a fixed partner list — i.e. that
  the salt is doing something — and the README must state that changing it **destroys the
  experiment**.

The stored `res.partner.almond_holdout` is a cache of that function, and — critically — the flag is
**snapshotted onto `pos.order.almond_holdout` at confirm time**. Reading group membership at
*analysis* time instead of *issue* time is the classic way to invalidate a holdout: anyone who moved
between groups (or whose salt changed) pollutes both arms. The snapshot is the experiment's
evidence; the partner flag is only the current state.

Holdout partners earn nothing and **must be told nothing** — the app shows no points UI for them.
The suppression happens **server-side only**; `almond_holdout` is deliberately absent from the POS
data load (§4.2 table) so a holdout customer's status cannot leak through a till screen.

### 4.12 The crons

| Cron | Schedule (UTC) | Amman | Does |
|---|---|---|---|
| `cron_window_roll` | daily 00:20 | 03:20 | §5: rebuild recent buckets, fold deltas, assign tiers, apply grace/demotion |
| `cron_window_reconcile` | weekly Sun 01:00 | 04:00 | §5.6: full rebuild, compare against incremental, report divergence |
| `cron_expire_points` | daily 00:10 | 03:10 | §4.8 expire lots |
| `cron_expiry_notice` | daily 05:00 | 08:00 | §4.8 T-30 / T-7 notices |
| `cron_birthday_grant` | daily 04:00 | 07:00 | §4.10 |
| `cron_reward_availability` | every 30 min | — | §4.6 |
| `cron_reward_repricing` | weekly Mon 02:00 | 05:00 | §4.5 (proposes only) |
| `cron_welcome_sweep` | hourly | — | §4.9, self-retiring |

**Jordan is permanently UTC+3** (DST abolished October 2022), so the conversion above is fixed and
does not shift twice a year. All branches are closed at 03:00 Amman.

Every cron record must set `nextcall` explicitly, exactly as
`almond_followers_guard/data/ir_cron.xml` does — otherwise the daily run anchors to whatever hour
the module happened to be installed and drifts into trading hours:

```xml
<field name="nextcall"
       eval="(DateTime.now().replace(hour=0, minute=20, second=0, microsecond=0)
              + timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S')"/>
```

Ordering matters: `cron_expire_points` (00:10) runs **before** `cron_window_roll` (00:20), so tier
qualification never sees points that expired the same night. State that dependency in both cron
descriptions, because a future maintainer will otherwise reorder them.

### 4.13 Security

`security/almond_loyalty_security.xml`, following `almond_branch`'s Odoo-19 idiom exactly
(`res.groups.privilege`, since `category_id` was removed from `res.groups` in 19):

```xml
<record id="privilege_almond_loyalty" model="res.groups.privilege">
    <field name="name">Almond Loyalty</field>
    <field name="category_id" ref="base.module_category_sales_point_of_sale"/>
</record>

<record id="group_almond_loyalty_auditor" model="res.groups">
    <field name="name">Loyalty Auditor</field>
    <field name="privilege_id" ref="privilege_almond_loyalty"/>
    <field name="comment">Reads the ledger, the window aggregates and the fraud reports. Writes nothing.</field>
</record>

<record id="group_almond_loyalty_manager" model="res.groups">
    <field name="name">Loyalty Manager</field>
    <field name="privilege_id" ref="privilege_almond_loyalty"/>
    <field name="implied_ids" eval="[(4, ref('almond_loyalty.group_almond_loyalty_auditor')),
                                     (4, ref('point_of_sale.group_pos_manager'))]"/>
</record>
```

`security/ir.model.access.csv` — note that **no group gets write on the lot or the bucket**. Those
are machine-written models; every write goes through `sudo()` in a named service, which is what makes
the ledger auditable:

```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_tier_pos_user,almond.tier.pos.user,model_almond_loyalty_tier,point_of_sale.group_pos_user,1,0,0,0
access_tier_manager,almond.tier.manager,model_almond_loyalty_tier,almond_loyalty.group_almond_loyalty_manager,1,1,1,1
access_timewindow_pos_user,almond.tw.pos.user,model_almond_loyalty_timewindow,point_of_sale.group_pos_user,1,0,0,0
access_timewindow_manager,almond.tw.manager,model_almond_loyalty_timewindow,almond_loyalty.group_almond_loyalty_manager,1,1,1,1
access_lot_auditor,almond.lot.auditor,model_almond_loyalty_point_lot,almond_loyalty.group_almond_loyalty_auditor,1,0,0,0
access_bucket_auditor,almond.bucket.auditor,model_almond_loyalty_window_bucket,almond_loyalty.group_almond_loyalty_auditor,1,0,0,0
access_avail_pos_user,almond.avail.pos.user,model_almond_loyalty_availability,point_of_sale.group_pos_user,1,0,0,0
access_avail_manager,almond.avail.manager,model_almond_loyalty_availability,almond_loyalty.group_almond_loyalty_manager,1,0,0,0
```

Multi-company record rules on every model carrying `company_id`, copied from
`almond_branch_security.xml` (a rule with no groups is global in v19):

```xml
<record id="almond_loyalty_tier_company_rule" model="ir.rule">
    <field name="name">Almond Loyalty Tier: multi-company</field>
    <field name="model_id" ref="model_almond_loyalty_tier"/>
    <field name="domain_force">['|', ('company_id', '=', False), ('company_id', 'in', company_ids)]</field>
</record>
```

The live fleet spans **four companies** across 14 POS shops (`almond_branch/hooks.py`). A tier
defined in one company must not silently apply in another — and the §5 bucket SQL must group by
`company_id` for the same reason.

**The three security properties a reviewer should verify by trying to break them:**

1. A `point_of_sale.group_pos_user` session **cannot** write `almond_tier_multiplier` (stored
   compute, no inverse ⇒ the ORM raises) or read `almond_tier_id` (`groups=` ⇒ hidden).
2. A POS user **cannot** read `almond_window_spend` — a cashier should not be able to see how much a
   customer spends.
3. Nobody, in any group, has `perm_write` on `almond.loyalty.point.lot`. The ledger is append-only
   through services.

---

## 5. Tier recomputation: the design that is not O(partners × window)

### 5.1 The problem, stated with the real numbers

3,238 invoices/day (BRIEF §1) ⇒ ~90,700 orders per 28 days. A 90-day qualification window holds
**~291,400 orders**.

Let `c` = member coverage (**[MEASURE]** — `tools/loyalty_measure.py` `section_coverage`; the
`ASSUMPTION` in the proposal is 35%, nobody has confirmed it) and `o` = orders per member per window.
Distinct partners to evaluate each night ≈ `291,400 × c / o`.

At `c=0.35`, `o=6` **[ASSUMPTION, both terms]** that is **~17,000 partners**; at `o=3`,
**~34,000**. The naive design — for each member, `read_group(pos.order, [partner, date ≥ today−90])`
— is one query per partner:

* 17,000–34,000 round trips per night.
* Each re-reads rows it already read 89 times before.
* Cost grows with **membership**, which is the number the programme exists to increase. The job gets
  slower precisely as the programme succeeds. That is the disqualifying property, more than the raw
  minutes.

Two other tempting designs, and why they lose:

| Rejected design | Cost | Why it fails |
|---|---|---|
| Postgres materialized view over the window, `REFRESH … CONCURRENTLY` nightly | Full re-read of ~291k orders every night; seconds, not minutes | It cannot hold per-row *applied* state, so it cannot express an incremental delta; it must be rebuilt whole. And Odoo does not own it across module upgrades — it is a schema object outside the ORM's world. Acceptable as an *analytics* view, not as the programme's source of truth. |
| Compute the window on demand, at the till, when the customer is identified | One grouped query per identification, 3,238×`c`/day | Puts an aggregate query **in the cashier's critical path** — the exact opposite of §6's budget. And it cannot work offline, so the tier shown offline would differ from the tier applied. Disqualified twice. |

### 5.2 The design: daily buckets + an `applied` cursor

```python
class AlmondLoyaltyWindowBucket(models.Model):
    _name = 'almond.loyalty.window.bucket'
    _description = 'Per-partner per-day spend/visit bucket (rolling-window source)'

    partner_id  = fields.Many2one('res.partner', required=True, index=True, ondelete='cascade')
    day         = fields.Date(required=True, index=True)
    company_id  = fields.Many2one('res.company', required=True, index=True)

    net_spend   = fields.Monetary(currency_field='currency_id')   # amount_total - amount_tax
    gross_spend = fields.Monetary(currency_field='currency_id')   # amount_total
    order_count = fields.Integer()

    # The cursor: what has ALREADY been folded into res.partner's rolling aggregates.
    applied_spend     = fields.Monetary(currency_field='currency_id', default=0.0)
    applied_visits    = fields.Integer(default=0)
    applied_ft_visits = fields.Integer(default=0)

    currency_id = fields.Many2one(related='company_id.currency_id', readonly=True)

    _uniq = models.Constraint('UNIQUE(partner_id, day, company_id)',
                              'One bucket per partner per day per company.')
    _day_idx     = models.Index('(day)')
    _partner_idx = models.Index('(partner_id, day)')
```

> **Why both `net_spend` and `gross_spend` are stored.** The 8% vs 16% tax question is *unresolved*
> (BRIEF §5) and this document is forbidden from silently picking one. Storing both columns means
> the answer can be changed later by re-reading a column, not by rebuilding 90 days of history. The
> extra cost is one `numeric` column on ~200k rows — a few MB. This is the cheapest possible hedge
> against the one open question that moves every cost figure by ~7%.

### 5.3 The nightly job, in five statements

**Step 1 — rebuild recent buckets.** One `INSERT … SELECT … GROUP BY`, not one query per partner:

```sql
INSERT INTO almond_loyalty_window_bucket
       (partner_id, day, company_id, net_spend, gross_spend, order_count,
        applied_spend, applied_visits, applied_ft_visits, create_date, write_date)
SELECT o.partner_id,
       (o.date_order AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Amman')::date,
       o.company_id,
       SUM(o.amount_total - o.amount_tax),
       SUM(o.amount_total),
       COUNT(*),
       0, 0, 0, now(), now()
  FROM pos_order o
 WHERE o.partner_id IS NOT NULL
   AND o.state IN ('paid', 'done', 'invoiced')
   AND o.date_order >= %(lookback_start)s
   AND o.date_order <  %(tomorrow)s
 GROUP BY 1, 2, 3
ON CONFLICT (partner_id, day, company_id) DO UPDATE
   SET net_spend   = EXCLUDED.net_spend,
       gross_spend = EXCLUDED.gross_spend,
       order_count = EXCLUDED.order_count,
       write_date  = now();
```

**`lookback_start = today − 3 days`, and the 3 is not arbitrary.** A POS session left open past
midnight, an offline order synced the next morning, or a refund all land rows into a day whose bucket
was already built. Rebuilding only *yesterday* would miss them permanently. Three days covers a
weekend-closed session; the reconciliation in §5.6 catches anything older.

Rows touched: ~3 days × (orders/day × c) grouped down to roughly **6,000–8,000 bucket rows**.
Wall time **[BUDGET] < 1 s** on an index over `pos_order(date_order)`.

**Step 2 — mark the expiring day.** Buckets with `day <= today − W` still holding a non-zero
`applied_*` must contribute a *negative* delta. They are not deleted yet — the cursor is what makes
the delta exact.

**Step 3 — fold the delta into `res.partner`. One statement.**

```sql
UPDATE res_partner p
   SET almond_window_spend  = COALESCE(p.almond_window_spend, 0)  + d.d_spend,
       almond_window_visits = COALESCE(p.almond_window_visits, 0) + d.d_visits,
       almond_ft_visits     = COALESCE(p.almond_ft_visits, 0)     + d.d_ft
  FROM (
    SELECT partner_id,
           SUM(CASE WHEN day > %(win_start)s THEN net_spend   ELSE 0 END - applied_spend)     AS d_spend,
           SUM(CASE WHEN day > %(win_start)s THEN order_count ELSE 0 END - applied_visits)    AS d_visits,
           SUM(CASE WHEN day > %(ft_start)s  THEN order_count ELSE 0 END - applied_ft_visits) AS d_ft
      FROM almond_loyalty_window_bucket
     WHERE day > %(win_start)s - INTERVAL '1 day'      -- freshly rebuilt + just-expired days
        OR applied_spend <> 0 OR applied_visits <> 0 OR applied_ft_visits <> 0
     GROUP BY partner_id
  ) d
 WHERE d.partner_id = p.id
   AND (d.d_spend <> 0 OR d.d_visits <> 0 OR d.d_ft <> 0);
```

**Step 4 — advance the cursor.**

```sql
UPDATE almond_loyalty_window_bucket
   SET applied_spend     = CASE WHEN day > %(win_start)s THEN net_spend   ELSE 0 END,
       applied_visits    = CASE WHEN day > %(win_start)s THEN order_count ELSE 0 END,
       applied_ft_visits = CASE WHEN day > %(ft_start)s  THEN order_count ELSE 0 END
 WHERE …same predicate as step 3…;
```

**Step 5 — prune.** `DELETE FROM … WHERE day < today − W − 7` (a week of slack for forensics).

> **The `applied_*` cursor is the whole idea, and it is worth one sentence of justification.**
> The delta is `current_value − last_applied_value`, computed *from the bucket table itself*. That
> makes the fold **exact and self-healing** for every case a naive add-today/subtract-day-91 scheme
> gets wrong: a refund that lowers a past day, a back-dated order arriving late, an offline order
> synced three days after the sale, a cron that failed to run last night, or a cron that ran twice.
> Re-running the job is a **no-op**, because the second run's delta is zero. Idempotence is not a
> nice property here — it is the only reason a nightly financial aggregate is safe to retry.

### 5.4 Two windows, one table

The fast-track (BRIEF §2: 12 visits/month ⇒ Silver; Dunkin' does the same, §4) needs a **30-day**
visit window while qualification uses **90-day** spend. The same buckets serve both — the only cost
is a third `applied_*` column, because the two windows expire on different days and each needs its
own cursor. That is why `applied_ft_visits` exists separately rather than being derived.

Adding a third window later (a 7-day streak, say) costs one column and one `CASE` arm. That
extensibility is the argument for buckets over any per-partner running total.

### 5.5 Tier assignment, promotion, grace, demotion

**Assignment: 3 statements, not a loop.** With N tiers, N `UPDATE`s in descending order, each
touching only rows whose pending tier actually changes:

```sql
UPDATE res_partner p SET almond_tier_pending_id = %(tier_id)s
 WHERE p.almond_window_spend >= %(qualify_spend)s
   AND p.almond_tier_pending_id IS DISTINCT FROM %(tier_id)s
   AND NOT EXISTS (SELECT 1 FROM almond_loyalty_tier t
                    WHERE t.sequence > %(seq)s
                      AND t.qualify_spend <= p.almond_window_spend);
```

plus one arm ORing in the visit fast-track (`almond_ft_visits >= qualify_visits`). The index on
`almond_window_spend` serves these.

**Then the policy, in Python, over the changed set only:**

```sql
SELECT id FROM res_partner
 WHERE almond_tier_pending_id IS DISTINCT FROM almond_tier_id
    OR almond_tier_grace_until IS NOT NULL;
```

**[BUDGET]** a few hundred to a few thousand rows a night — the number of people who crossed a
threshold, not the number of members. Browse those and apply:

| Situation | Action |
|---|---|
| pending **>** effective | Promote immediately. `almond_tier_since = today`, clear grace, notify. Promotion is never delayed — it is the moment the programme is working. |
| pending **<** effective, no grace armed | **Do not demote.** Arm `almond_tier_grace_until = today + 30`, notify "you have 30 days to keep فضّي". |
| pending **<** effective, grace expired | Demote **one step only** (proposal's rule). `almond_tier_since = today`. Re-arm a fresh grace if still below the new tier. |
| pending **≥** effective while grace armed | Clear the grace silently. The customer never learns they were nearly demoted. |

> **State the cost of this kindness, because nobody else will.** With a 90-day window, one-step
> demotion and a 30-day grace re-armed at each step, a customer who stops visiting entirely takes
> **90 + 30 + 30 = 150 days** to fall from ذهبي to عضو. During those five months they are earning at
> the top multiplier on any occasional visit. That is a real liability line, it is a deliberate
> choice, and the design artifact must price it rather than inherit it silently. The alternative —
> demote straight to the qualifying tier after one grace — is 120 days and is defensible; what is not
> defensible is not knowing which one is configured.

### 5.6 The reconciliation, and why an incremental job needs one

`cron_window_reconcile` (weekly) recomputes the aggregates **the slow, obviously-correct way** and
compares:

```sql
SELECT b.partner_id, SUM(b.net_spend) AS truth, p.almond_window_spend AS held
  FROM almond_loyalty_window_bucket b
  JOIN res_partner p ON p.id = b.partner_id
 WHERE b.day > CURRENT_DATE - %(W)s
 GROUP BY b.partner_id, p.almond_window_spend
HAVING ABS(SUM(b.net_spend) - COALESCE(p.almond_window_spend, 0)) > 0.005;
```

One pass over ~200k bucket rows, **[BUDGET] 1–3 s**. It **reports** divergence (a manager-visible
list plus a log line) and does **not** silently repair — because a silent repair hides the bug that
caused the divergence, and the whole point of holding a nightly incremental aggregate is that you
can prove it right. Repair is a separate, deliberate, manager-triggered action.

Add a second reconciliation against the *source*, monthly: buckets vs `pos_order` directly. That one
catches a bug in step 1's SQL, which the bucket-vs-partner check cannot see.

### 5.7 Cost summary

| Job | Rows touched | Frequency | **[BUDGET]** |
|---|---|---|---|
| Bucket rebuild (3-day lookback) | ~6–8k | nightly | < 1 s |
| Delta fold into partners | ~5–10k partners | nightly | < 1 s |
| Cursor advance | ~10k buckets | nightly | < 1 s |
| Tier assignment (N statements) | only changed rows | nightly | < 1 s |
| Policy pass (Python) | few hundred–few thousand | nightly | 2–10 s |
| **Nightly total** | | | **[BUDGET] < 30 s** |
| Weekly reconciliation | ~200k buckets | weekly | 1–3 s |
| Steady-state table size | 90 d × ~2.3k/d ≈ **207k rows**; at a 12-month window ≈ **840k rows** | | tens of MB |

The complexity that matters: **O(daily active partners) per night, O(1) in window length, and
independent of total membership.** The job does not get slower as the programme succeeds. That is
the property the naive design lacked, and it is the reason for every column above.

Every budget in this table is a target. **[MEASURE]** Instrument the cron to log elapsed
milliseconds and rows touched per step, and put the first week's real numbers in the README, so
these become observations rather than intentions.

---

## 6. The POS flow, timed

### 6.1 The budget, derived

3,238 invoices/day. **+1 second per invoice = 3,238 s/day = 54 minutes of cashier time across the
fleet**; ≈ 6.7 min/branch/day; ≈ 41 hours/branch/year. +2 s ≈ 1.8 cashier-hours/day, matching
`BRIEF.md` §5.

**[DECISION] The targets:**

| | **[BUDGET]** |
|---|---|
| Non-member order | **0 ms added.** Not "small" — zero. |
| Identification | ≤ 2.0 s of *till* time |
| Earn display | 0 additional round trips, ever |
| Redemption, end to end | ≤ 2.0 s of till time |

The non-member zero is the most important line. **[MEASURE]** member coverage `c` is unknown; if it
is 35%, then 65% of 3,238 orders/day must not pay one millisecond for a programme they are not in.
Concretely: every JS patch begins with `if (!order.get_partner()) return super(...)`, and every
Python override begins with the same guard. A reviewer should check this on every single patched
method — it is the difference between a 54-minute cost and a 19-minute one.

### 6.2 Identification

| Method | Till time **[BUDGET]** | Runs where | Verdict |
|---|---|---|---|
| **App QR scanned at the till** — the repo already defines the token `ALMOND\|MEMBER\|{userId}\|MODE=PAY\|EARN` (`docs/ODOO-INTEGRATION.md` §1) | scan 0.2 s + partner resolution 0.0–0.4 s | scanner → client; resolution client-side **if the partner is already in the POS's loaded set**, otherwise **one server `search_read`** | **Primary.** The customer's phone-unlocking happens in parallel with ringing items, *if the cashier asks at the start of the order.* That sequencing is a training item, not a code item, and it is worth more seconds than any optimisation in this document. |
| **Phone number typed** | 4–6 s typing + 0.3 s search, **plus 8–20 s if OTP-confirmed** | server search | **Supervisor-gated fallback only.** It is simultaneously the slowest path and the fraud vector BRIEF §2.5 names: at 3,238 invoices/day, unauthenticated phone lookup is the classic cashier self-crediting channel. Ungated it is unacceptable; OTP-gated it costs 10–25 s and cannot be the default. Give it its own counter and put it in the daily top-earner-per-branch report. |
| **Card token → partner** (the MEPS/Apex path already in this repo, `integrations/pos_meps_apex/`) | **0 s** | server, asynchronously, after payment | **The Phase-2 answer.** Identification with no ask, no scan, no typing. Requires explicit customer consent and a careful look at what the payment integration is allowed to retain. Worth scoping early precisely *because* it removes the whole §6.2 cost line. |

> **[MEASURE]** Every number in this table is a budget. Ship an opt-in sampler
> (`ir.config_parameter almond_loyalty.pos_timing_sample = 50`) that records `performance.now()`
> deltas for 1 order in 50 into `pos.order.almond_timing_json`, and report the real distribution
> after two weeks. Until then, nobody — including this document — knows what identification costs at
> Almond's tills.

### 6.3 Earn display and redemption

**Earn display: 0 round trips, by construction.** Every input is already in the browser (§4.2 table),
so the points figure updates inside the existing OWL reactive recompute as lines change. Cost:
microseconds of arithmetic.

**[DECISION] Any design in which the till asks the server "how many points is this order worth?" is
disqualified.** That is 3,238 round trips/day placed in the critical path, and it breaks offline.

**Redemption:**

| Step | Client / server | **[BUDGET]** |
|---|---|---|
| Cashier opens the rewards list | client | 0.3 s |
| Rungs render, with tier / off-peak / availability / channel gates applied | **client** — all gate data is preloaded (§4.4, §4.6) | 0.0 s |
| Cashier (or customer) picks a rung | human | *decision time, not till time* |
| **Redemption confirm** | **server, synchronous, mandatory** | 0.6–0.9 s on 4G; hard timeout 2.5 s |
| Reward line added, receipt updated | client | 0.1 s |
| **Total till time** | | **≈ 1.0–1.3 s** |

The server confirm does four things atomically, and each one is a reason it cannot be client-side:
re-check the balance against the authoritative card; consume lots FIFO (§4.8); write
`loyalty.history`; return the new balance. On timeout the POS shows *"Cannot redeem — no
connection"* and the reward is not applied.

> **What the cashier must NOT be allowed to do on that timeout: hand-discount instead.** That
> converts a blocked redemption into an untracked discount, and Almond's entire commercial position
> is a discount culture at 1.5–2% of sales (BRIEF §1). Make the manual-discount button require a
> manager PIN whenever a loyalty redemption failed on the same order, and count those events.

### 6.4 Fleet cost of the design

At **[ASSUMPTION]** 35% member coverage and **[ASSUMPTION]** 20% of member orders redeeming:

* Identification: 1,133 orders/day × ~1.0 s ≈ **19 min/day** fleet-wide.
* Redemption: 227 orders/day × ~1.2 s ≈ **4.5 min/day**.
* Non-members: **0**.
* **Total ≈ 24 min/day ≈ 0.4 cashier-hours** — against the 1.8 hours that a careless +2 s design
  would cost.

Both assumptions are unmeasured. The sensitivity is linear in coverage, so the honest statement is:
*the design costs roughly 1 second of till time per identified member, and the fleet bill is that
second times however many members there turn out to be.* **[MEASURE]** coverage via
`tools/loyalty_measure.py`.

---

## 7. Offline

### 7.1 The invariant

> **Earning is additive and idempotent per order. Spending is not. Therefore earn happens offline
> and spending never does.**

Everything below follows from that one line.

### 7.2 What works offline, what is blocked

| Operation | Offline | Why |
|---|---|---|
| **Earn points** | ✅ **works** | Additive. Its idempotency key is the order itself. And refusing to earn offline punishes the customer for the branch's wifi — which produces a manual counter adjustment, which is itself a fraud vector (BRIEF §2.5). |
| Show tier / multiplier | ✅ works | Loaded on the partner record; a snapshot, possibly stale. |
| Show points balance | ⚠️ **works, but labelled** | Display *"balance as of 14:32"*, never a confident number. A stale balance shown confidently is how a customer is told they can afford a reward they cannot. |
| **Redeem a reward** | ❌ **blocked** | See §7.3. |
| Charge the wallet / redeem a gift card | ❌ blocked | Monetary balance. Same argument, higher stakes. |
| **Spin the wheel** | ❌ blocked | A randomised prize granted client-side can be re-rolled by replaying the sale. (Note defect **D6** separately: the wheel currently has no losing slot at all — EV ≈ 2.67 JOD/spin ≈ 7.4% of an average invoice. Offline is not its biggest problem.) |
| Welcome credit / birthday grant | ❌ blocked | "Once ever" and "once per year" both need a server. |
| Enrol a new member | ⚠️ queue, do not grant | Create the partner offline; the welcome credit is granted by `cron_welcome_sweep` after sync (§4.9). |

### 7.3 Why redemption cannot be allowed offline — concretely

Two tills at one branch, both offline. Customer has 300 points. Till A shows 300 and redeems a
300-point rung. Till B still shows 300 and redeems another. **600 points spent from a 300-point
balance, and no client can detect it** — neither till can see the other, and the balance each holds
was correct when it was loaded.

There is no client-side mitigation. Not a shorter cache TTL, not a per-till reservation, not a
signed balance. The invariant in §7.1 is the only defence, and it is why the confirm in §6.3 is
synchronous and mandatory.

### 7.4 Reconciliation on reconnect — the double-issue defence, in layers

**Layer 1 — the idempotency key is the order UUID, enforced by the database.**
Odoo POS orders carry a client-generated `uuid` **[STOCK, probe — see §8; it is the single most
load-bearing stock field in this module]**. `almond.loyalty.point.lot` carries `pos_order_uuid` with
`UNIQUE(pos_order_uuid, program_id)` (§4.8). A replayed sync raises a unique violation, which the
service catches and treats as *"already issued"*. **The guarantee lives in Postgres, not in
application logic**, which means it survives a retry storm, two workers racing, a restore, and a
future refactor by someone who has not read this document.

**Layer 2 — points are recomputed from the order's own snapshot, not from today's state.**
`pos.order` stores `almond_tier_multiplier_applied`, `almond_earn_base`, `almond_earn_total`,
`almond_channel`, `almond_holdout` — snapshotted **client-side at sale time**. On sync the server
recomputes from *those* values, not from the partner's current tier. Otherwise a customer promoted
between the sale and the sync gets paid at the new rate for an old order, and a demoted one gets paid
less than the receipt in their hand says. The receipt is the contract; the snapshot is what makes it
enforceable.

**Layer 3 — divergence is paid, bounded, and reported.**
The server recomputes independently and compares with the client's `almond_earn_total`. If they
differ:

* **Pay the client's number.** The customer holds a receipt. **[DECISION]** Silently paying the
  smaller number is exactly Dunkin' 2022 (BRIEF §4) and exactly defect **D2**; it is a trust failure
  that is discovered publicly, not internally.
* Write the difference to `pos.order.almond_earn_divergence` and raise it in a **daily divergence
  report**. A non-zero divergence rate means the two evaluators in §4.2 have drifted — it is the
  alarm that the golden-vector test was supposed to prevent.
* **Bound it.** Honour the client's number only up to `min(3 × recomputed, ABS_CEILING)`. Above
  that, `state='quarantined'` on the lot and a manual review. An unbounded "trust the client" rule is
  a compromised-till jackpot.

**Layer 4 — stale queues are quarantined, not issued.**
An order syncing more than `N` days (default 7) after `date_order` is quarantined for review rather
than auto-issued. A very old offline queue is the classic replay vector, and legitimate ones are rare
enough to review by hand.

**Layer 5 — the queue contains only earn.**
Because redemption is server-synchronous (§6.3), no redemption is ever *in* the offline queue. That
is what keeps reconciliation tractable: the sync path handles exactly one kind of event, additive,
idempotent, and independently recomputable. Say this as an invariant in the code, and add a test
asserting no redemption record can be created without a server round trip — because the day someone
"optimises" redemption into the queue for latency, this entire section becomes false.

---

## 8. What breaks on upgrade

Every stock field this module leans on, what it is used for, and what happens if it moves.
**All rows are [STOCK] — assumed from the addon design, unverified against the live database. §9
probes them.**

| Stock surface | Used for | Known volatility | Blast radius if it moves | Guard |
|---|---|---|---|---|
| **`pos.order.uuid`** | §7.4 idempotency key | Introduced in 17 | **Catastrophic and SILENT.** The unique constraint would sit on a NULL column, every replay would double-issue, and nothing would raise. | `post_init` **hard assert** + a boot-time check. This is the one field whose absence must abort the install, not warn. |
| `res.partner._load_pos_data_fields` / `_load_pos_data_domain` | Shipping tier/multiplier to POS | **Highest churn in Odoo.** Was `_loader_params_res_partner` ≤17, renamed for the 18 POS data-service rewrite. Expect movement every major. | Tier data never reaches the till ⇒ everyone earns ×1.0 silently. | **All POS-loading overrides in `models/pos_data_loading.py` and nowhere else**, with a header comment listing the per-version history. One file to fix per upgrade. |
| `pos_loyalty` front-end JS (`PosOrder.prototype._updatePrograms`, `getClaimableRewards`, module paths under `static/src/app/`) | Earn display, reward gating | **Very high.** The POS front end was rewritten in 18 and continues to move. | Points display breaks, or breaks *quietly* (shows stock's number, not ours). | Patch the **smallest** surface: prefer *adding* a getter and rendering it in our own OWL component over overriding a stock method. **Every patched symbol listed in `static/src/app/patches.js`** so an upgrade grep has one target. |
| **`loyalty.card.expiration_date`** | Deliberately **not** used | Stable, but semantically hostile | **A trap.** If anyone ever sets it, stock expires the whole card and zeroes a balance our lot ledger still believes in. Two ledgers, silently disagreeing. | A `@api.constrains` on `loyalty.card` that **refuses** a non-null `expiration_date` while the almond lot ledger is active, with an error message explaining why. Refuse, do not warn. |
| `loyalty.history` order back-reference (`order_id` + `order_model` in 17+, vs `pos_order_id` in 16) | Writing ledger rows | **Changed between 16 and 17.** | Ledger rows write with a wrong or missing back-reference; the audit trail degrades without erroring. | Probe with `fields_get`, branch once in a helper, never inline. |
| `loyalty.rule.reward_point_mode` ∈ `{order, money, unit}` | Base earn (row #1) | Stable | Base earning misconfigured. | Probe the selection values; assert `'money'` is present. |
| `loyalty.rule.minimum_amount_tax_mode` | The 8%/16% basis | Stable | 7–15% error in total programme cost. | Probe; surface the live value in the audit report rather than assuming. |
| `loyalty.reward.discount_mode = 'per_point'` | Cash redemption (#6b) *if adopted* | Stable | Only bites if cash redemption is chosen. | Probe the selection. |
| `loyalty.program.pricelist_ids` | **Not used** (§1.2, rejected) | — | none | Listed so nobody "discovers" it post-upgrade. |
| `pos.order.state` values `{paid, done, invoiced}` | §5 bucket SQL predicate | Stable but not guaranteed | Buckets silently miss or double-count orders ⇒ wrong tiers. | Probe the selection; assert the set at install. |
| `pos_order` / `res_partner` raw column names in §5 SQL | The window engine | Column names stable; **`amount_tax` semantics are not**, given the open tax question | Aggregates wrong by the tax rate. | Store both net and gross (§5.2) so the basis is a column choice, not a migration. |
| `res.groups.privilege` | Security (§4.13) | **New in 19** (`res.groups.category_id` removed) | Install fails loudly — the good kind. | Already the house idiom (`almond_branch_security.xml`). |
| `report.pos.order._select()` / `_from()` | Inherited via `almond_branch` | Rewritten when the POS report SQL changes | Branch dimension disappears from reports. | Already documented in `almond_branch/models/report_pos_order.py`. |

### 8.1 The install-time assertion

`hooks.py` runs a `post_init_almond_loyalty` that **raises** rather than degrades — following
`almond_branch/hooks.py`'s shape but with the opposite failure policy, because a loyalty module that
half-installs pays customers the wrong number:

```python
REQUIRED = {
    'pos.order':      ['uuid', 'partner_id', 'date_order', 'state', 'amount_total', 'amount_tax'],
    'loyalty.card':   ['points', 'program_id', 'partner_id'],
    'loyalty.rule':   ['reward_point_mode', 'reward_point_amount', 'minimum_amount_tax_mode'],
    'loyalty.reward': ['required_points', 'reward_type', 'reward_product_id'],
    'loyalty.history':['card_id', 'issued', 'used'],
    'res.partner':    ['property_product_pricelist'],
}
# For each model: env[model].fields_get() and assert every name is present.
# Missing 'pos.order.uuid'  -> raise. Anything else missing -> raise with the field named.
```

### 8.2 The upgrade checklist (put this in the README)

1. Run the §9 probe against the upgraded database **before** installing the module.
2. Diff `models/pos_data_loading.py` against the new `_load_pos_data_*` signatures.
3. Diff every symbol in `static/src/app/patches.js` against the new `pos_loyalty` source.
4. Run the golden-vector test (§4.2) — it is the only thing that proves the two evaluators still
   agree after a JS refactor.
5. Run `cron_window_reconcile` manually and confirm zero divergence.
6. Confirm `loyalty.card.expiration_date` is still null everywhere.

---

## 9. The probe: verifying every [STOCK] claim before writing code

Nothing in §2 or §8 may be relied upon until it has been read from the live database. The probe is
**read-only**, needs no `APPROVE PROD` token precisely because it writes nothing, and — per
`IMPL-BRIEF.md` — **runs outside this container** (the egress proxy 403s `*.odoo.com`).

`tools/loyalty_audit_live.py` already has the plumbing: an env loader, a `SAFE_METHODS` allow-list
that refuses any non-read method before it crosses the wire, and `detect_capabilities()`. Rather
than duplicate a tool, add this manifest to it:

```python
# Field manifest for the almond_loyalty module (docs/LOYALTY-ODOO-MODULE.md §8).
# Every entry is a [STOCK] claim that must be VERIFIED before the module is written.
# For each: fields_get(model) and report PRESENT / MISSING / TYPE-MISMATCH.
# Selection fields additionally report their actual values.
STOCK_SURFACE = {
    'pos.order':       {'uuid': 'char', 'partner_id': 'many2one', 'date_order': 'datetime',
                        'state': 'selection', 'amount_total': 'monetary', 'amount_tax': 'monetary',
                        'config_id': 'many2one'},
    'loyalty.program': {'program_type': 'selection', 'applies_on': 'selection',
                        'trigger': 'selection', 'pos_ok': 'boolean', 'sale_ok': 'boolean',
                        'pos_config_ids': 'many2many', 'date_from': 'date', 'date_to': 'date',
                        'limit_usage': 'boolean', 'max_usage': 'integer',
                        'pricelist_ids': 'many2many'},          # expected present; NOT used (§1.2)
    'loyalty.rule':    {'reward_point_mode': 'selection', 'reward_point_amount': 'float',
                        'minimum_amount': 'monetary', 'minimum_amount_tax_mode': 'selection',
                        'minimum_qty': 'integer', 'product_ids': 'many2many',
                        'product_domain': 'char', 'mode': 'selection'},
    'loyalty.reward':  {'reward_type': 'selection', 'required_points': 'float',
                        'discount': 'float', 'discount_mode': 'selection',
                        'discount_applicability': 'selection', 'discount_max_amount': 'monetary',
                        'reward_product_id': 'many2one', 'active': 'boolean'},
    'loyalty.card':    {'points': 'float', 'code': 'char', 'expiration_date': 'date',
                        'program_id': 'many2one', 'partner_id': 'many2one'},
    'loyalty.history': {'card_id': 'many2one', 'issued': 'float', 'used': 'float',
                        'description': 'char'},
    # Shape of the order back-reference CHANGED between 16 and 17 — report which exists:
    'loyalty.history?':{'order_id': 'any', 'order_model': 'any', 'pos_order_id': 'any'},
}
```

The probe must also answer four **[MEASURE]** questions that decide design parameters this document
deliberately left open:

1. **Which `program_type` and `reward_point_mode` does the LIVE program use today?** The whole
   redesign rests on a verbal claim ("flat 5 points/JOD, tiers are names only") that nobody has
   checked (`IMPL-BRIEF.md` §"Why this exists").
2. **What is `minimum_amount_tax_mode` on the live earn rule?** This is the 8%/16% question made
   concrete (BRIEF §5) and it moves every cost figure by ~7%.
3. **Is any `loyalty.card.expiration_date` set?** If yes, §8's trap is already armed and the lot
   ledger cannot be introduced until those are understood.
4. **How many distinct partners have a POS order in the last 90 days?** This is `c`, the coverage
   term that every cost estimate in §5.1 and §6.4 is linear in — and the only reason those sections
   give formulas rather than numbers.

---

## 10. Build order

Each phase is independently shippable and independently reversible. Nothing after phase 0 starts
until phase 0's answers exist.

| Phase | Contents | Gate |
|---|---|---|
| **0** | §9 probe against the live database. No module code. | Every `[STOCK]` claim VERIFIED or the design revised. `c` measured. |
| **1** | `almond.loyalty.tier`, `res.partner` fields, `§5` window engine, `cron_window_roll` + reconcile. **No earning change** — tiers computed and observed only. | Two weeks of nightly runs, zero reconciliation divergence, tier distribution reviewed against the "3–8% top tier" intent (BRIEF §2, review point 2 warns 20–30% will actually qualify). |
| **2** | `services/earn.py` + `earn_formula.js` + golden vectors + `pos_data_loading.py`. Multipliers **live**. §4.3 cap and combo. | Zero divergence in the §7.4 daily report. POS timing sampler shows §6 budgets are met. |
| **3** | Redemption ladder (stock #6), FIFO lots, expiry + notices. | Liability measurable via `tools/loyalty_measure.py`. |
| **4** | Gated rewards: off-peak, tier, availability, channel. Holdout. Birthday. Repricing proposals. | Holdout arms balanced; the experiment is readable. |

Phase 1's shape is the important one: **compute tiers for two weeks before paying anyone
differently.** It costs nothing, it is fully reversible, and it turns "20–30% will reach Gold" from a
reviewer's warning into a measured fact before a single multiplier is paid out.

---

## 11. Open questions this document does not close

1. **Tax basis, 8% vs 16%** (BRIEF §5). Flagged, not picked. Mitigated structurally by storing both
   net and gross in §5.2 so the answer can change without a rebuild.
2. **Cash redemption (100 pts = 1 JOD) vs rung-only.** Stock supports both (#6, #6b); the capability
   is not the constraint and the choice belongs to the design artifact.
3. **Window length: 90 days (proposal) vs rolling 12 months (repo).** §5 is agnostic — it is one
   parameter. The cost difference is 207k vs 840k bucket rows, which is not a reason to choose either.
4. **Demotion depth**: one step per grace (150 days from ذهبي to عضو) vs straight to qualifying
   (120 days). §5.5 states both costs; the number must be chosen deliberately.
5. **`MAX_TIER_MULTIPLIER`'s value.** §4.1 makes the ceiling *reachable* by construction, fixing the
   shape of defect **D1**. Its numeric value is an economics decision, not an engineering one.
