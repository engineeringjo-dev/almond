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
| 1 | **Base earn per JOD** | **YES — fully** | `loyalty.program(program_type='loyalty')` + `loyalty.rule(reward_point_mode='money', reward_point_amount=5)`. One rule, no code. **The 8%/16% tax question lands exactly here** — but *not* on the field a reader expects. `loyalty.rule.minimum_amount_tax_mode` ∈ `{incl, excl}` **[STOCK, probe]** governs the tax mode of the `minimum_amount` **qualification threshold**, not the basis on which `reward_point_mode='money'` is evaluated. **The configuration does not state that basis at all.** It has to be measured from awarded points — which `tools/loyalty_audit_live.py:1616 probe_money_mode_tax_basis` already does. That basis is a 7–15% swing on total program cost (BRIEF §5). Do not pick it silently and do not read it off `minimum_amount_tax_mode` — §9 names the measurement. |
| 2 | **Tier multipliers** (×1.0 / ×1.25 / ×1.5 …) | **NO — CUSTOM** | Fails on §1.2: no partner input on any rule. Pricelist trick rejected (§1.2). → **§4.1, §4.2** |
| 3 | **Rolling-window tier qualification** (spend over last N days) | **NO — CUSTOM** | Stock has no tier concept, no window, no aggregate. `loyalty.card.points` is a *balance*, not a *qualification*, and spending points would demote you — which is the wrong semantics entirely. → **§4.1, §5** |
| 4 | **Demotion with one-step + grace** | **NO — CUSTOM** | Follows #3. Note this is where Starbucks 2019 lost the argument publicly (BRIEF §4): demotion mechanics are a communications artefact as much as a code artefact. → **§4.1, §5.5** |
| 5 | **Visit-based fast-track** (e.g. 12 visits/30 d ⇒ Silver) | **NO — CUSTOM** | Needs a *second* rolling window of a different length over the same event stream. Free once #3's structure exists (§5.4), impossible without it. → **§5.4** |
| 6 | **Redemption ladder, fixed-point rungs** | **YES — fully** | One `loyalty.reward` per rung: `reward_type='product'`, `required_points=100/250/400…`, `reward_product_id`. Caribou's 8 rungs (25→400) map 1:1. **This is the single thing stock does really well** — and the proposal's most important idea (a 100-point first rung, PROPOSAL §) needs no code at all. |
| 6b | **Cash-value redemption** (100 pts = 1 JOD off) | **YES — fully** | `reward_type='discount'`, `discount_mode='per_point'`, `discount=0.01`, `discount_applicability='order'`. Stock supports it. Whether Almond *should* is a live disagreement (BRIEF §5) — out of scope for this artifact, but note the capability is not the constraint. |
| 7 | **Cost-based reward pricing** (rungs priced by COGS, not menu price) | **NO — CUSTOM (process, not field)** | `required_points` is a float you type. Nothing derives it from `product.standard_price`. And auto-repricing is *dangerous*: silent devaluation is precisely what broke Dunkin' in 2022 (BRIEF §4). → **§4.5** (propose-only cron + human apply) |
| 8 | **Availability-gated rewards** (hide a reward when the item is out) | **NO — CUSTOM, and the signal itself must be MEASURED** | `loyalty.reward.active` is a manual switch; nothing watches stock. Worse: Almond's items are largely non-storable, so `qty_available` is meaningless for a latte. **There is no stock availability signal for a coffee product.** → **§4.6** |
| 9 | **Off-peak-only rewards** (free drink 14:00–16:00) | **NO — CUSTOM** | `loyalty.program.date_from/date_to` are **dates**, not times of day, and they gate the whole program, not one reward. No day-of-week mask, no hour range, anywhere. → **§4.4** |
| 10 | **Channel differential** (in-store vs delivery) | **PARTIAL — see the finding** | Stock gives `program.pos_ok` / `sale_ok` / `pos_config_ids`, which separates *POS* from *sales orders*. That is enough for in-store vs own-app delivery. **But the real finding is upstream:** the 23% of payment value arriving via Talabat/Careem's own apps (BRIEF §1) reaches Odoo with **no marketplace-supplied customer identity** — **[ASSUMPTION]**, and a well-founded one. That the revenue is therefore *unearnable* does **not** follow: it rules out marketplace-supplied identity, not customer-supplied proof of purchase (§4.7). This document no longer closes that question. Own-app delivery via Ishbek (`docs/DELIVERY-INTEGRATION.md`) lands as a sale order and *is* addressable. → **§4.7**, and §9 probe question 5 measures what a marketplace order actually carries. |
| 11 | **Combo bonus** (drink + food in one basket) | **NO — CUSTOM** | Fails on §1.3: rules are OR'd; there is no conjunction operator. Also note defect **D4** — in the repo's own implementation the combo bonus is added *after* the cap and escapes it. The Odoo implementation must place it *inside* the cap (#15). → **§4.3** |
| 12 | **Points expiry with notice** | **PARTIAL → CUSTOM** | `loyalty.card.expiration_date` **[STOCK, probe]** expires **the entire card**, on one date, with no notice and no tranches. It cannot express "points earned in January expire next January while December's live on". And it is a *trap*: if anyone ever sets it, stock zeroes the balance behind the custom ledger's back (§8). Also fixes defect **D5** (expiry currently inverted: the largest balances never expire). → **§4.8** |
| 13 | **Welcome / head-start credit** | **CUSTOM-LITE** | No stock "first order only" rule. But no new model is needed either: create the `loyalty.card` with a non-zero `points` at enrolment, write one `loyalty.history` row and one point lot. The only real work is **idempotency** — one grant per partner, ever, including across an offline sync — and *not* granting it to the entire pre-existing partner base on first run. → **§4.9** |
| 14 | **Birthday reward** | **NO — CUSTOM (cron) over stock storage** | `communication_plan_ids` fires on *program* events, not on the calendar. The issuance *storage* is stock (a `coupons`-type program), but the trigger, the idempotency table and the birthday field are all ours, so this row counts as **fully custom** in the score below. Note `res.partner` has **no birthday field** in stock — one must be added, and §4.10 argues for month+day only. |
| 15 | **Per-invoice point cap** | **NO — CUSTOM** | `limit_usage` / `max_usage` count *program usages*, not points. There is no per-order point ceiling anywhere. This is the field defect **D1** was supposed to be (`MAX_EARN_MULTIPLIER=5` is dead code: max reachable stack is 18.75× against a 25× cap). The Odoo cap must be **reachable by construction** — §4.3 makes it a hard clamp applied last, with the combo bonus *inside* it. |
| 16 | **Control-group holdout** (10% earn nothing, measured) | **NO — CUSTOM** | Fails on §1.2. And the naive implementation — a random boolean — is wrong for a different reason: it is not reproducible, not auditable, and re-randomises as partners are created. → **§4.11** (deterministic hash, snapshotted onto the order) |

**Score: the table has 17 rows (1–16 plus 6b). 3 fully stock (#1, #6, #6b), 2 partial (#10, #12),
1 custom-lite (#13), 11 fully custom (#2, #3, #4, #5, #7, #8, #9, #11, #14, #15, #16). 3+2+1+11 = 17.**
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
│   ├── almond_loyalty_reprice_log.py  # NEW almond.loyalty.reprice.log      (§4.5)
│   ├── almond_loyalty_birthday_grant.py # NEW almond.loyalty.birthday.grant (§4.10)
│   ├── res_partner.py              # INHERIT  tier, window aggregates, holdout, birthday
│   ├── product_template.py         # INHERIT  almond_86_until / almond_86_by (§4.6)
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
├── wizards/
│   ├── __init__.py
│   └── almond_loyalty_repair.py    # NEW  the manager-triggered window repair (§5.6, §10)
├── data/
│   ├── ir_cron.xml                 # eight crons (§4.12) — cron_welcome_sweep ships DISABLED
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
│   ├── almond_loyalty_repair_views.xml
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
        'views/almond_loyalty_repair_views.xml',
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
    # [DECISION] The tier ladder is FLEET-WIDE, not per company. company_id is deliberately
    # absent: one brand, one ladder. See the callout below and §4.13.
    currency_id   = fields.Many2one('res.currency', required=True,
                                    default=lambda self: self.env.ref('base.JOD'))
    color         = fields.Char()
    active        = fields.Boolean(default=True)

    _unique_code = models.Constraint(
        'UNIQUE(code)', 'A tier with this code already exists.')
```

> **[DECISION] Tiers are fleet-wide, and the whole of §5 is built on that.** The live fleet is
> **four companies across 14 POS shops** (`integrations/almond_branch/hooks.py`: "14 POS shops
> across 4 companies collapse into 9 branches"), but it is **one brand to the customer**. A customer
> who buys at Mecca Street (Evora) and at City Mall (Italian Corner) is one member with one balance
> and one tier. This is not a shortcut — it is the commercial answer, and it is the reason
> `almond.loyalty.tier` carries no `company_id`, the reason `res.partner` (a company-shared model in
> Odoo) can legitimately hold the aggregates, and the reason §5.3's fold groups by `partner_id`
> alone.
>
> The alternative — per-company ladders — is *not* implementable on the models in this document:
> `res.partner` cannot hold four tiers and four window aggregates. Choosing it means moving
> `almond_tier_id`, `almond_window_spend`, `almond_window_visits` and `almond_ft_visits` off
> `res.partner` into a per-(partner, company) row, and adding a `company_id` term to every statement
> in §5.3, §5.4 and §5.5. That is a different design; do not half-adopt it.
>
> **The one precondition fleet-wide summation has:** all four companies must transact in the same
> currency, or `SUM(net_spend)` across them is meaningless. §9 probe question 6 verifies that;
> the buckets keep `company_id` (for per-company reporting and for the currency check), and the
> `currency_id` on the tier is a fixed fleet currency rather than a company-derived one.

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
| `almond_tier_multiplier` | Float, **stored compute, no inverse**, `depends=['almond_tier_id.earn_multiplier']`, plus `groups=` + a `write()` rejection | ORM compute | `groups='almond_loyalty.group_almond_loyalty_manager'`; POS reads it through the explicit sudo read in `pos_data_loading.py` |
| `almond_tier_name` | Char, **stored compute, no inverse**, same gating | ORM compute | manager; POS reads it through `pos_data_loading.py` |
| `almond_window_spend` | Monetary, `index=True` | §5 raw SQL | manager + auditor |
| `almond_window_visits` | Integer | §5 raw SQL | manager + auditor |
| `almond_ft_visits` | Integer | §5 raw SQL | manager + auditor |
| `almond_holdout` | Boolean, `index=True` | recomputed from the §4.11 hash (never written by a client) | manager + auditor; **loaded to POS read-only** via `pos_data_loading.py` (§4.11) |
| `almond_welcome_granted` | Boolean | §4.9 | manager |
| `almond_birth_month` / `almond_birth_day` | Integer | customer / staff | user |

> **How cashier self-promotion is actually closed — three controls, not one belief.**
> An earlier draft of this document claimed that "a stored computed field without an inverse raises
> on `write()`" and rested the module's main fraud control on that one sentence. That is a claim
> about Odoo 19 ORM behaviour; §0's rule says a `[STOCK]` claim may not be depended on until it is
> verified, and this one is neither marked nor probed. **It is therefore not the control.** The
> exposure is real and this document names it: `almond_tier_multiplier` sits on `res.partner`, a
> model POS cashiers hold write access to precisely so they can create and edit customers at the
> till.
>
> The control is all three of the following, and each is independently sufficient:
>
> 1. **`groups=` on `almond_tier_id`, `almond_tier_name` AND `almond_tier_multiplier`.** All three
>    are gated to `group_almond_loyalty_manager`. POS gets the number and the label through an
>    explicit `sudo()` read in `pos_data_loading.py` — a read path the module owns and a reviewer
>    can find in one file — not through an ungated field.
> 2. **A `write()` override on `res.partner`** that raises `AccessError` if any of the almond tier,
>    window or holdout fields is in `vals` and the user is not in the manager group. Explicit,
>    greppable, and independent of ORM compute semantics.
> 3. **A positive test.** A `group_pos_user` session calls
>    `partner.write({'almond_tier_multiplier': 2.0})` and the test asserts the raise. **[MEASURE]**
>    — the test is what turns "the ORM protects us" from an assumption into an observation, and it
>    runs on every upgrade (§8.2).
>
> The stored-compute-without-inverse shape is kept because it is good hygiene and it makes the
> field's provenance obvious. It is no longer *cited* as the security boundary.

### 4.2 The earn formula — one definition, two evaluators (row #2)

This is the section that decides whether defect **D2** recurs.

**[DECISION] The arithmetic is duplicated (it must be — §1.4 requires it in the browser for offline).
The *parameters* are not duplicated. Not one of them.**

Every input to the formula is a **field on a record the POS already loads**:

| Input | Where it lives | How POS gets it |
|---|---|---|
| points per JOD | `loyalty.rule.reward_point_amount` | stock POS load |
| **earn tax basis** (gross vs net) | `ir.config_parameter almond_loyalty.earn_tax_basis` ∈ `{gross, net}` — a **module-level** setting, *not* a stock rule field | `pos_data_loading.py` |
| tier multiplier | `res.partner.almond_tier_multiplier` | `pos_data_loading.py` (explicit sudo read) |
| per-invoice cap | `loyalty.program.almond_per_invoice_point_cap` | `pos_data_loading.py` |
| combo bonus | `loyalty.program.almond_combo_points` | `pos_data_loading.py` |
| holdout | `res.partner.almond_holdout` — loaded read-only so the client suppresses the points line (§4.11); the **server** is the authority and never trusts the loaded value | `pos_data_loading.py` |

> **Why the tax basis is a config parameter and not `loyalty.rule.minimum_amount_tax_mode`.**
> That stock field sets the tax mode of the rule's `minimum_amount` **qualification threshold**. It
> does not say what quantity `reward_point_mode='money'` multiplies. Wiring
> `amount_on_tax_basis` from it builds both evaluators on the wrong number and produces a confident
> answer to a question the configuration never asked.
> **[MEASURE]** The real answer is empirical and the instrument already exists:
> `tools/loyalty_audit_live.py:1616 probe_money_mode_tax_basis` compares `loyalty.history.issued`
> against `pos.order.amount_total` and `amount_total - amount_tax` on real awarded points, and
> refuses a verdict when the sample is too small or too wide. Its verdict is written *once* into
> `almond_loyalty.earn_tax_basis`, and both evaluators read that one parameter.
> `minimum_amount_tax_mode` is still probed and reported (§9) because a threshold in the wrong mode
> is its own bug — it is simply not this one.

`services/earn.py` and `static/src/app/earn_formula.js` implement the same five lines in the same
order, and the order is load-bearing:

```
if holdout: return 0                               # FIRST. Both evaluators. See §4.11.
base      = amount_on_tax_basis * points_per_jod   # basis from almond_loyalty.earn_tax_basis
tiered    = base * tier_multiplier
combo     = combo_points * combo_pairs(lines)      # INSIDE the cap — fixes D4
subtotal  = tiered + combo
total     = min(subtotal, per_invoice_cap)         # LAST. Nothing is added after this line.
```

Four rules the reviewer should enforce on this file pair:

1. **Nothing is added after `min()`.** Defect **D4** is exactly one misplaced line; the cap must be
   the terminal operation in both files, and a test must assert `earn(huge order) == cap`.
2. **No date arithmetic anywhere in the formula.** Defect **D3** — a hardcoded Friday `+50%` living
   in no config, unturnoffable from admin — happened because a *day of week* got into the earn path
   as a literal. Day-of-week promotions belong in `loyalty.program` records with real date ranges,
   or in the §4.4 time-window model, never in the formula. A grep for `getDay`/`weekday` in this
   module should return nothing.
3. **The holdout short-circuit is line one in both files.** If the client does not evaluate it, the
   receipt in a control-arm customer's hand shows points the server will not issue, and every
   holdout order lands in the §7.4 divergence report. See §4.11 for why the flag is shipped to the
   till despite being an experiment artefact.
4. **A golden-vector test file shared by both.** A JSON fixture of ~30 (inputs → expected points)
   cases, loaded by the Python test and by the JS test — including at least two holdout cases and
   two cases per tax basis. If the two implementations drift, CI fails before a customer notices.
   This is the only structural defence that survives a refactor.

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
   **[ASSUMPTION]** *The marketplace will not hand over a customer key* — the customer is *its*
   asset, not Almond's. That assumption is well supported by how aggregators behave commercially,
   and this document keeps it.

> **What that assumption does NOT establish, and an earlier draft of this section wrongly closed.**
> "The marketplace will not supply identity" defeats only **marketplace-supplied** identity. It says
> nothing about **customer-supplied** proof of purchase: a code printed on the aggregator receipt,
> entered by the customer in Almond's own app, needs no cooperation from Talabat or Careem at all
> and is standard practice. Whether that path is worth building is a **strategy question about 23%
> of payment value**, and a capability-boundary document is the wrong place to close it.
>
> Nothing in this repository establishes what a marketplace order record even contains: `grep -rn -i
> talabat` returns Ishbek/last-mile plumbing and menu generation (`almond-web/src/server/ishbek.ts`,
> `packages/shared/src/integration/index.ts`) and no Odoo-side order shape. **[MEASURE]** §9 probe
> question 5 asks what model those orders land as and which of `partner_id` / phone / order
> reference is populated. Until that answer exists, "unearnable" is an assumption, not a finding.

**What this does reframe.** Kudu's 20 pts/SAR in-store vs 10 for delivery (BRIEF §4) is a
*deliberate* differential between two channels you own. Almond's situation is different: the
differential is between "channels we own" and "a fifth of revenue we currently cannot see". The
loyalty programme's channel lever is therefore not primarily a discount dial — it is the *reason* to
move customers off the marketplaces onto the own-app delivery path, which is exactly what the Ishbek
integration exists to do. Hand both that argument and the customer-supplied-proof option to the
design artifact. This module builds neither, and it does not pretend the second one is impossible.

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

    # --- identity -------------------------------------------------------------------
    source      = fields.Selection([('earn','Earn'), ('welcome','Welcome'),
                                    ('birthday','Birthday'), ('adjustment','Adjustment'),
                                    ('migration','Legacy migration')],
                                   required=True, index=True)
    source_key  = fields.Char(required=True, index=True)   # discriminated, NEVER NULL — see below
    pos_order_uuid = fields.Char(index=True)     # lookup column only; NOT the constraint key

    notice_30_sent = fields.Boolean(default=False)
    notice_7_sent  = fields.Boolean(default=False)

    _uniq_issue = models.Constraint(
        'UNIQUE(source_key, program_id)',
        'A point lot with this source key already exists for this program.')
    _earn_needs_uuid = models.Constraint(
        "CHECK (source <> 'earn' OR pos_order_uuid IS NOT NULL)",
        'An earn lot must carry the POS order uuid it was issued for.')
    _lot_expiry_idx = models.Index('(state, expiry_date) WHERE state = \'open\'')
```

> **`source_key` exists because `pos_order_uuid` cannot be the key, and the earlier draft's version
> of this constraint would have stopped the programme dead.** That draft declared
> `UNIQUE NULLS NOT DISTINCT (pos_order_uuid, program_id)`. PostgreSQL's `NULLS NOT DISTINCT`
> (PG15+) makes `(NULL, 7)` collide with `(NULL, 7)` — that is its entire semantic difference from
> the default. Three specified lot sources have no POS order behind them: the §4.9 welcome credit,
> the §4.10 birthday grant, and any goodwill adjustment. There is no `partner_id` in the key either,
> so the collision is **global, not per customer**: exactly one welcome lot and one birthday lot
> could ever exist, for the whole fleet, forever. And because §7.4 Layer 1 catches a unique violation
> on this constraint and treats it as *"already issued"*, customer #2 onward would be **silently**
> recorded as already paid.
>
> `source_key` is a **non-nullable discriminated string** and carries the identity of whatever
> produced the lot:
>
> | `source` | `source_key` | Means |
> |---|---|---|
> | `earn` | `pos:<uuid>` or `sale:<order_id>` | one lot per order per program (§7.4) |
> | `welcome` | `welcome:<partner_id>` | one welcome credit per partner, ever (§4.9) |
> | `birthday` | `birthday:<partner_id>:<year>` | one birthday grant per partner per year (§4.10) |
> | `adjustment` | `adj:<uuid4>` | always unique; adjustments are never deduplicated |
> | `migration` | `migrate:<card_id>` | one legacy backfill lot per card (§4.8 migration) |
>
> Plain `UNIQUE` with default NULL semantics is then correct for every source at once, and the
> `CHECK` keeps §7.4's argument honest: a POS-sourced lot **must** carry its uuid, so "the guarantee
> lives in Postgres" is a statement about a column that cannot be null on that path.
> `pos_order_uuid` survives as an indexed lookup column — reports and the divergence report join on
> it — but nothing depends on its uniqueness.

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

#### The migration, which is not a technical detail

Balances are decremented **only** when a lot expires, and `expiry_date` is `required=True`, so no
lot can exist without one. Pre-existing `loyalty.card.points` have no lots. That leaves exactly two
outcomes at install, and an earlier draft of this document chose neither — which is how a silent
devaluation ships:

* **Backfill without a plan** — every existing member's balance suddenly acquires an expiry date. If
  they all get the same one, that is a **single-day cliff** applied to the whole book. This is
  Dunkin' 2022 (BRIEF §4) with the numbers filled in.
* **Do not backfill** — then Σ lots ≠ `card.points` from day one, the FIFO consumption in §6.3 draws
  on a ledger that does not cover the balance, and legacy points never expire. **Defect D5 stays
  unfixed for exactly the large permanent balances D5 is about.**

**[DECISION] Backfill, staggered, announced, and gated like §4.5 gates repricing:**

1. **Measure first.** Run `tools/loyalty_measure.py section_liability` **before** the backfill and
   record the JOD at risk. **[MEASURE]** — that number is the size of the decision, and it does not
   exist yet.
2. **Stagger from behaviour, not from install date.** Each legacy card gets one `migration` lot
   (`source_key = 'migrate:<card_id>'`) whose `expiry_date` is derived from the card's **last earn
   date**, not from the day the module was installed. Members who have been dormant for a year and
   members who bought yesterday must not expire on the same morning.
3. **Floor the first expiry at install + 12 months.** Nobody's existing balance may expire sooner
   than a year after they were told the rule changed, whatever the stagger computes.
4. **Notice before the first sweep.** `cron_expiry_notice` runs at T-30 and T-7 over the migration
   cohort **before** `cron_expire_points` is enabled for the first time. Enabling the sweep is a
   deliberate act, not a consequence of installing the module.
5. **Gate the phase on the communication, not only on the finance.** See §10, Phase 3.

The alternative — grandfathering legacy balances as never-expiring — is *defensible* and costs the
programme a permanent liability tail. What is not defensible is shipping either one without saying
which was chosen.

### 4.9 Welcome / head-start credit (row #13)

No new model. On enrolment, create the `loyalty.card` with `points = WELCOME_POINTS`, write one
`almond.loyalty.point.lot` with `source='welcome'` and
`source_key = 'welcome:<partner_id>'`, and set `res.partner.almond_welcome_granted = True` **in the
same transaction**.

**The idempotency is the `source_key` unique constraint from §4.8**, not a partial index. An earlier
draft claimed a `UNIQUE(partner_id) WHERE program_id = welcome_program` partial index; no such index
appears on any model here, and a partial-index predicate cannot reference a data-dependent program
id declared in a static model constraint. `UNIQUE(source_key, program_id)` over
`'welcome:<partner_id>'` says the same thing, statically, and is the constraint that actually exists.
The `almond_welcome_granted` boolean is a fast filter, not the guarantee.

> **`cron_welcome_sweep` ships DISABLED, and here is the accident it would otherwise have.**
> The sweep was specified as "catches partners created by code paths that bypassed the hook —
> imports, the BFF, an offline enrolment — and is a no-op once nothing is found". On its **first run
> after install, every partner already in the database bypassed the hook**, because the hook did not
> exist. `almond_welcome_granted` defaults `False` on every existing row, so it stops a *second*
> grant and does nothing about the first. With no date predicate, no cap, no enrolment test and no
> holdout exclusion, the first tick issues `WELCOME_POINTS` to the entire pre-existing partner base
> in one hour.
>
> **[DECISION]** The sweep is therefore specified as:
>
> * `create_date >= <install timestamp>`, stored once in
>   `ir.config_parameter almond_loyalty.welcome_epoch` by `post_init` — partners predating the module
>   are never swept, they are handled (or not) by a deliberate one-off migration.
> * **AND** an explicit enrolment marker: a partner who exists because a cashier typed their phone
>   number into a receipt is not a member.
> * **AND** `not almond_holdout` — §4.10's birthday cron already checks this and §4.9 must too.
> * A **per-run row cap** (`almond_loyalty.welcome_sweep_cap`, default 200) with a log line whenever
>   it is hit. A sweep that keeps hitting its cap is a bug report, not a backlog.
> * A **dry-run mode** that logs what it would grant and grants nothing, and it is the mode the cron
>   ships in.
> * `ir_cron.xml` sets `active="False"`. Enabling it is a deliberate act.
>
> **[MEASURE] `WELCOME_POINTS` has no value in this document and must not get one by default.**
> Before the cron is enabled, the probe (§9) must produce `WELCOME_POINTS × eligible-partner-count`
> as a JOD figure — at 1 point = 1 qirsh (BRIEF §1) that is `WELCOME_POINTS × n / 100` JOD of
> one-time liability — and someone with signing authority must accept it. This is the cheapest
> possible sign-off and the only thing standing between an install and an unbudgeted issuance.

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
program with an expiry of ~14 days. Idempotency, at two levels that agree:
`almond.loyalty.birthday.grant(partner_id, year)` with `UNIQUE(partner_id, year)` for the grant
record, and `source='birthday'` / `source_key = 'birthday:<partner_id>:<year>'` on the point lot
(§4.8) for the points themselves. Cheap table, exact semantics, survives a cron retry and a restore.

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

The stored `res.partner.almond_holdout` is a cache of that function, and it is
**snapshotted onto `pos.order.almond_holdout`**. Reading group membership at *analysis* time instead
of *issue* time is the classic way to invalidate a holdout: anyone who moved between groups pollutes
both arms. The snapshot is the experiment's evidence; the partner flag is only the current state.

> **[DECISION — resolves a contradiction two earlier sections carried in opposite directions.]**
> §4.2's input table used to say `almond_holdout` was "not loaded — server-only", this section said
> it was "deliberately absent from the POS data load", and §7.4 Layer 2 required the browser to
> snapshot it at sale time. **A browser cannot snapshot a field it was never sent**, and both
> branches of the contradiction were expensive:
>
> * *Not shipped:* the till's earn formula, ignorant of holdout, computes and **prints a non-zero
>   points figure on a control-arm customer's receipt** while the server issues zero. Every such
>   order then reads as a client/server divergence. At this document's own figures — 1,133 member
>   orders/day (§6.4) × 10% holdout — that is **~113 divergences per day**, a daily divergence report
>   that is ~100% false alarm, and a Phase-2 gate ("zero divergence", §10) that the control arm alone
>   makes unreachable.
> * *Shipped naively:* a modified client could flip the flag.
>
> **The resolution: ship the flag, keep the authority on the server.**
>
> 1. `almond_holdout` **is** loaded to POS (§4.2 table) as a plain boolean on the partner record. Its
>    only job in the browser is to make the earn formula return 0 (§4.2, rule 3), so the till prints
>    **no points line at all** for a holdout customer — which is exactly what "must be told nothing"
>    requires. It is never rendered, never labelled, and never exposed in a customer-search column;
>    the leak §4.11 worried about is a *UI* concern and is solved by not drawing it.
> 2. The **server never trusts the loaded value.** On sync it recomputes `almond_holdout` from the
>    deterministic hash above and writes the snapshot itself. The hash is stable, so the sale-time
>    and sync-time values agree by construction — which is precisely why the snapshot does not need
>    to come from the client, and why a flipped client flag buys an attacker nothing but a wrong
>    receipt.
> 3. **A holdout order is excluded from divergence accounting** (§7.4 Layer 3). It is not a
>    divergence; it is the experiment working.
>
> Changing the salt reassigns the arms and **destroys the experiment** — including the meaning of
> every snapshot already taken. The README must say so in those words.

Holdout partners earn nothing. The suppression is **enforced server-side** and *displayed*
client-side; the server is the authority in both directions.

### 4.12 The crons

| Cron | Schedule (UTC) | Amman | Does |
|---|---|---|---|
| `cron_window_roll` | daily 00:20 | 03:20 | §5: rebuild recent buckets, fold deltas, assign tiers, apply grace/demotion |
| `cron_window_reconcile` | weekly Sun 01:00 | 04:00 | §5.6: full rebuild, compare against incremental, report divergence |
| `cron_expire_points` | daily 00:10 | 03:10 | §4.8 expire lots. **Ships `active="False"`** — the first sweep is irreversible and is gated on the §4.8 migration notices (§10 Phase 3) |
| `cron_expiry_notice` | daily 05:00 | 08:00 | §4.8 T-30 / T-7 notices |
| `cron_birthday_grant` | daily 04:00 | 07:00 | §4.10 |
| `cron_reward_availability` | every 30 min | — | §4.6 |
| `cron_reward_repricing` | weekly Mon 02:00 | 05:00 | §4.5 (proposes only) |
| `cron_welcome_sweep` | hourly | — | §4.9, self-retiring. **Ships `active="False"` and in dry-run**; enabling it requires the `WELCOME_POINTS × eligible-partners` sign-off (§4.9) |

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
access_reprice_log_auditor,almond.reprice.log.auditor,model_almond_loyalty_reprice_log,almond_loyalty.group_almond_loyalty_auditor,1,0,0,0
access_birthday_grant_auditor,almond.birthday.grant.auditor,model_almond_loyalty_birthday_grant,almond_loyalty.group_almond_loyalty_auditor,1,0,0,0
access_repair_wizard_manager,almond.repair.manager,model_almond_loyalty_repair,almond_loyalty.group_almond_loyalty_manager,1,1,1,0
```

Both audit models (`almond.loyalty.reprice.log`, `almond.loyalty.birthday.grant`) are read-only to
the auditor and machine-written through `sudo()`. A model with **no** `ir.model.access.csv` row is
inaccessible to every non-superuser and logs a warning at install, which is why they are listed here
rather than left implicit in §4.5 and §4.10.

Multi-company record rules on **the models that carry `company_id`** — which, after the §4.1
decision, means the bucket and the availability proxy, **not** the tier. Copied from
`almond_branch_security.xml` (a rule with no groups is global in v19):

```xml
<record id="almond_loyalty_bucket_company_rule" model="ir.rule">
    <field name="name">Almond Loyalty Bucket: multi-company</field>
    <field name="model_id" ref="model_almond_loyalty_window_bucket"/>
    <field name="domain_force">['|', ('company_id', '=', False), ('company_id', 'in', company_ids)]</field>
</record>
```

The live fleet spans **four companies** across 14 POS shops
(`integrations/almond_branch/hooks.py`: "14 POS shops across 4 companies collapse into 9 branches").
An earlier draft required a tier defined in one company not to apply in another, and required "the
§5 bucket SQL to group by `company_id` for the same reason" — while §5 grouped by `partner_id`
alone and wrote into single-valued fields on `res.partner`, which is a company-*shared* model. Those
two statements could not both be implemented, and the losing side was silent: with N tiers × 4
companies the §5.5 assignment statements overwrite each other and the surviving tier is whichever
ran last.

**Resolved in favour of a fleet-wide ladder (§4.1).** The tier carries no `company_id`, so there is
no per-company tier to leak; the aggregates on `res.partner` are deliberately fleet-wide totals; and
§5.3 / §5.5 are written to match. Buckets keep `company_id` for per-company **reporting** and for
the currency precondition, and the record rule above scopes that reporting. If per-company ladders
are ever adopted, §4.1's callout lists everything that has to move — it is a redesign, not a
`GROUP BY` change.

**The four security properties a reviewer should verify by trying to break them:**

1. A `point_of_sale.group_pos_user` session **cannot** write `almond_tier_multiplier`. The control
   is the `groups=` attribute plus the `res.partner.write()` override (§4.1), and the assertion is a
   **test**, not a belief about ORM compute semantics. The same session cannot read
   `almond_tier_id`, `almond_tier_name` or `almond_tier_multiplier` directly — POS receives the
   number and the label only through the explicit sudo read in `models/pos_data_loading.py`.
2. A POS user **cannot** read `almond_window_spend` — a cashier should not be able to see how much a
   customer spends.
3. Nobody, in any group, has `perm_write` on `almond.loyalty.point.lot`. The ledger is append-only
   through services.
4. The window **repair** (§5.6) is reachable only through
   `almond.loyalty.repair`, a manager-only wizard that writes buckets under `sudo()` and logs one
   audit row per repair. No group holds `perm_write` on the bucket table directly.

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
> extra cost is one `numeric` column on ~100k rows (§5.7) — a few MB. This is the cheapest possible hedge
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
       COUNT(*) FILTER (WHERE o.amount_total > 0)
         - COUNT(*) FILTER (WHERE o.amount_total < 0),          -- visits, net of refunds
       0, 0, 0, now(), now()
  FROM pos_order o
 WHERE o.partner_id IS NOT NULL
   AND o.state IN ('paid', 'done', 'invoiced')
   -- Both bounds are Asia/Amman CALENDAR DATES shifted into UTC. Jordan is fixed UTC+3.
   AND o.date_order >= (%(lookback_start_amman)s::date - INTERVAL '3 hours')
   AND o.date_order <  (%(tomorrow_amman)s::date     - INTERVAL '3 hours')
 GROUP BY 1, 2, 3
ON CONFLICT (partner_id, day, company_id) DO UPDATE
   SET net_spend   = EXCLUDED.net_spend,
       gross_spend = EXCLUDED.gross_spend,
       order_count = EXCLUDED.order_count,
       write_date  = now();
```

> **Every date parameter in §5 is an Asia/Amman calendar date, and the SQL says so.** The bucket key
> is `date_order AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Amman'`, so a row filter stated in raw UTC
> midnights does not line up with it. Amman day D spans UTC `[D−1 21:00, D 21:00)`. With
> `lookback_start` as a bare UTC midnight — the obvious reading, and what `fields.Date.today()`
> hands you — the slice **00:00–03:00 Amman on the oldest lookback day is excluded from that day's
> rebuild**, and §4.12 states the branches are still trading then ("all branches are closed at 03:00
> Amman"). Because the `ON CONFLICT` clause **overwrites** rather than adds, the previous night's
> correct bucket for that day is replaced by a truncated one — permanently, since the day drops out
> of the lookback tomorrow. Step 3 then propagates the loss faithfully into `almond_window_spend`
> and `almond_window_visits`. That is exactly the silent tier drift §5.3 exists to prevent. The
> symmetric error at the upper bound invents buckets dated *tomorrow* for orders in UTC
> `[today 21:00, today+1 00:00)`.
>
> The offset is fixed (DST abolished 2022), so the fix is an explicit shift, written above.
> `lookback_start_amman`, `tomorrow_amman`, `win_start` and `ft_start` are **all** Amman dates, and
> §5.6 uses the same expression rather than `CURRENT_DATE`.

**`lookback_start_amman = today_amman − 3 days`, and the 3 is not arbitrary.** A POS session left
open past midnight, an offline order synced the next morning, or a refund all land rows into a day
whose bucket was already built. Rebuilding only *yesterday* would miss them permanently. Three days
covers a weekend-closed session; the reconciliation in §5.6 catches anything older.

> **How Odoo actually books a POS refund, because the rest of this section depends on it.** A refund
> is a **new** `pos.order` row with negative amounts, its own `date_order` (the refund moment, not
> the sale's) and the same `partner_id`, reaching `paid`/`done`. It does **not** lower the original
> day's bucket. So:
>
> * **Spend** self-corrects, because the negative `amount_total` lands in the refund day's bucket and
>   the rolling sum nets out — provided the refund day is inside the lookback or a later rebuild.
> * **Visits do not**, under a plain `COUNT(*)`: a sale plus its refund nets spend to zero and
>   records **two** visits. `almond_window_visits` and `almond_ft_visits` drive the §5.4 fast-track
>   (12 visits in 30 days ⇒ فضّي) and the §5.5 promotion arm, so a ring-and-refund loop is a free
>   promotion — and §6.2 already names the unauthenticated phone lookup as the cashier
>   self-crediting channel that would drive it.
>
> Hence the `FILTER` clauses above: a visit is a positive-total order, and a refund **cancels** one.
> A partner-day can therefore have a zero or negative visit count; the fold in Step 3 handles that
> arithmetically, and the `@api.constrains`-equivalent is a floor at zero applied to the
> `res.partner` aggregate, not to the bucket.

Rows touched: a bucket row is one per (partner, day, company), so the count cannot exceed member
orders in the lookback. At `c = 0.35` **[ASSUMPTION, linear in c]** that is
`3 × 3,238 × 0.35 ≈ 3,400 orders`, grouping down to **≤ 3,400 bucket rows** and in practice fewer.
**[MEASURE]** §9 probe question 4 (distinct partners with a POS order in the last 90 days) replaces
the `c` this is linear in. Wall time **[BUDGET] < 1 s** on an index over `pos_order(date_order)`.

**Step 2 — mark the expiring day.** Buckets with `day <= today − W` still holding a non-zero
`applied_*` must contribute a *negative* delta. They are not deleted yet — the cursor is what makes
the delta exact.

**Step 3 — fold the delta into `res.partner`. One statement.**

The fold groups by `partner_id` **only**, with no `company_id` term. That is deliberate and it
follows §4.1's decision: **the tier ladder is fleet-wide**, so a member's window aggregate is the sum
of their spend across all four companies. `res.partner` is company-shared in Odoo, which is what
makes a single scalar per partner the correct shape here — and would make it the *wrong* shape under
a per-company ladder. The precondition is one currency across the fleet (§9 probe question 6).

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
> gets wrong: a refund booked as a negative order into a *later* day's bucket (which is how Odoo
> books one — see Step 1), a back-dated order arriving late, an offline order synced three days after
> the sale, a cron that failed to run last night, or a cron that ran twice.
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

There is **no `company_id` term** in either the `UPDATE` or the `NOT EXISTS` subquery, and that is
correct **only because §4.1 made the ladder fleet-wide**. Under a per-company ladder this statement
is broken twice over: with N tiers × 4 companies the statements overwrite each other (the surviving
tier being whichever ran last), and a tier row belonging to another company can suppress the correct
assignment through the un-filtered `NOT EXISTS`. If per-company tiers are ever adopted, `t.company_id
= %(company_id)s` goes in the subquery, `almond_tier_pending_id` moves off `res.partner`, and this
whole section is rewritten — see §4.1.

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
-- Driven from res_partner, NOT from the buckets: a partner with a stale non-zero aggregate and
-- NO surviving bucket is exactly the failure this check exists to catch, and an inner join from
-- the bucket table cannot see them. %(today_amman)s is an Asia/Amman date (§5.3), not CURRENT_DATE.
SELECT p.id AS partner_id,
       COALESCE(t.spend, 0)     AS truth_spend,  COALESCE(p.almond_window_spend, 0)  AS held_spend,
       COALESCE(t.visits, 0)    AS truth_visits, COALESCE(p.almond_window_visits, 0) AS held_visits,
       COALESCE(f.ft_visits, 0) AS truth_ft,     COALESCE(p.almond_ft_visits, 0)     AS held_ft
  FROM res_partner p
  LEFT JOIN LATERAL (
        SELECT SUM(b.net_spend) AS spend, SUM(b.order_count) AS visits
          FROM almond_loyalty_window_bucket b
         WHERE b.partner_id = p.id
           AND b.day > %(today_amman)s::date - %(W)s
  ) t ON TRUE
  LEFT JOIN LATERAL (
        SELECT SUM(b.order_count) AS ft_visits
          FROM almond_loyalty_window_bucket b
         WHERE b.partner_id = p.id
           AND b.day > %(today_amman)s::date - %(FT)s
  ) f ON TRUE
 WHERE (p.almond_window_spend  IS NOT NULL AND p.almond_window_spend  <> 0)
    OR (p.almond_window_visits IS NOT NULL AND p.almond_window_visits <> 0)
    OR (p.almond_ft_visits     IS NOT NULL AND p.almond_ft_visits     <> 0)
    OR t.spend IS NOT NULL
   AND (ABS(COALESCE(t.spend, 0)  - COALESCE(p.almond_window_spend, 0))  > 0.005
     OR COALESCE(t.visits, 0)    <> COALESCE(p.almond_window_visits, 0)
     OR COALESCE(f.ft_visits, 0) <> COALESCE(p.almond_ft_visits, 0));
```

> **Three things this query does that the obvious one does not, and each is a class of divergence the
> obvious one is blind to.**
>
> 1. **It is driven from `res_partner`.** An inner join *from* the buckets contributes no row for a
>    partner who has no bucket inside the window — so a stale non-zero `almond_window_spend` left
>    behind when all of a partner's activity ages out is invisible, and that is precisely the failure
>    mode of a subtract-on-expiry cursor. Step 3's negative delta depends on the `OR applied_spend <>
>    0 …` arm firing on **every** bucket leaving the window; miss it once — a pruned bucket, a
>    cascade-deleted partner, an off-by-one in `win_start` — and the residue is a positive aggregate
>    with zero surviving buckets, reported here with `truth = 0`.
> 2. **It checks visits, both windows.** §5.4 makes `almond_ft_visits` a promotion trigger in its own
>    right (12 visits/month ⇒ فضّي), so a wrong visit count promotes people for free. Comparing only
>    `net_spend` lets that pass the §10 gate.
> 3. **It uses the Amman date expression from §5.3**, not `CURRENT_DATE`, which carries the same
>    UTC-vs-Amman mismatch documented in Step 1 and would shift the window boundary by three hours
>    against the `day` column it is compared to.

One pass over the bucket rows, **[BUDGET] 1–3 s**. It **reports** divergence (a manager-visible
list plus a log line) and does **not** silently repair — because a silent repair hides the bug that
caused the divergence, and the whole point of holding a nightly incremental aggregate is that you
can prove it right.

**Repair is a named, manager-triggered action — and it exists.** An earlier draft deferred to "a
separate, deliberate, manager-triggered action" that had no model, no method, no menu and no ACL,
while §4.13 granted the auditor read and nobody else anything on the bucket table — so the repair
the design depends on could not be performed by the person the design names. It is specified here:
`almond.loyalty.repair` is a **wizard** (`wizards/almond_loyalty_repair.py`, menu under Loyalty →
Maintenance), restricted to `group_almond_loyalty_manager`, that takes the divergence list,
re-derives the affected partners' aggregates from the buckets under `sudo()`, and writes **one audit
row per repair** (partner, field, old value, new value, user, timestamp, the reconciliation run that
found it). Bucket writes stay `sudo()`-only through this one service; no group gets `perm_write` on
the table.

Add a second reconciliation against the *source*, monthly: buckets vs `pos_order` directly. That one
catches a bug in step 1's SQL, which the bucket-vs-partner check cannot see.

### 5.7 Cost summary

Every row below is derived from **one** stated coverage figure — `c = 0.35`
**[ASSUMPTION, linear in c]**, the same one §5.1 and §6.4 use — and the arithmetic is shown so that
replacing `c` replaces the table. Member orders/day `= 3,238 × c ≈ 1,133`. A bucket row is one per
(partner, day, company), so **bucket rows/day ≤ member orders/day**; the two are equal only if no
member ever buys twice in a day, which makes 1,133/day an upper bound.

| Job | Rows touched | Frequency | **[BUDGET]** |
|---|---|---|---|
| Bucket rebuild (3-day lookback) | ≤ 3 × 1,133 ≈ **3.4k** | nightly | < 1 s |
| Delta fold into partners | ~5–10k partners | nightly | < 1 s |
| Cursor advance | ~10k buckets | nightly | < 1 s |
| Tier assignment (N statements) | only changed rows | nightly | < 1 s |
| Policy pass (Python) | few hundred–few thousand | nightly | 2–10 s |
| **Nightly total** | | | **[BUDGET] < 30 s** |
| Weekly reconciliation | ≤ ~102k buckets | weekly | 1–3 s |
| Steady-state table size | 90 d × ≤1,133/d ≈ **≤ 102k rows**; at a 12-month window ≈ **≤ 414k rows** | | tens of MB |

> **[ASSUMPTION, linear in c]** An earlier draft carried "~2.3k/d ⇒ 207k rows" and a "6,000–8,000
> row" 3-day rebuild. Both imply `c ≈ 0.70` — twice the coverage the same document assumes twenty
> lines earlier — and 6–8k is above the arithmetic ceiling of its own formula (3 × 1,133 = 3,399
> orders, and `GROUP BY` can only reduce that). Two different `c` values were being carried through
> one document. **[MEASURE]** §9 probe question 4 ("how many distinct partners have a POS order in
> the last 90 days?") is the instrument that replaces the assumption; until it answers, every figure
> in this table scales linearly with `c` and none of them is an observation.

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
> after two weeks. **The sampler must also record WHICH identification method was used** — QR, phone,
> card token — because the fleet cost in §6.4 is a *blend* of these rows, and without the mix that
> blend is an assumption wearing a measurement's clothes. Until then, nobody — including this
> document — knows what identification costs at Almond's tills.

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

> **[ASSUMPTION] The 1.0 s is a blend, and it assumes the phone fallback is ≤ 3.4% of
> identifications.** §6.2's own table gives QR as 0.2–0.6 s and the phone path as 12.3–26.3 s
> (4–6 s typing + 0.3 s search + 8–20 s OTP). 1.0 s is above the QR *maximum* and far below the phone
> *minimum*, so it can only be a mix. Solving `0.6x + 12.3(1−x) = 1.0` gives `x = 0.966` — the
> headline holds only if at most ~3.4% of identifications fall back to phone.
>
> **Sensitivity: roughly +1.7 min/day fleet-wide per percentage point of phone-path share.** At a 10%
> fallback share the blend is ~1.9 s ⇒ ~36 min/day; at 20% it is ~3.0 s ⇒ ~57 min/day, which also
> breaches §6.2's own "≤ 2.0 s of till time" identification budget. The fallback share is therefore
> not a footnote — it is the term the whole §6 cost case turns on, and it is a **training and
> supervisor-gating** outcome, not an engineering one.

All three assumptions — coverage, redemption rate, fallback share — are unmeasured. The sensitivity
is linear in each, so the honest statement is: *the design costs roughly 1 second of till time per
identified member who scans, ~12 s per member who does not, and the fleet bill is whatever mix
turns up.* **[MEASURE]** coverage via `tools/loyalty_measure.py`; the mix via the §6.2 sampler.

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
| Enrol a new member | ⚠️ queue, do not grant | Create the partner offline; the welcome credit is granted by `cron_welcome_sweep` after sync (§4.9) — **once that cron has been enabled**, which is a deliberate Phase-4 act. Until then an offline enrolment earns normally and simply has no welcome credit; it is never granted twice, because the `welcome:<partner_id>` source key is unique (§4.8). |

### 7.3 Why redemption cannot be allowed offline — concretely

Two tills at one branch, both offline. Customer has 300 points. Till A shows 300 and redeems a
300-point rung. Till B still shows 300 and redeems another. **600 points spent from a 300-point
balance, and no client can detect it** — neither till can see the other, and the balance each holds
was correct when it was loaded.

There is no client-side mitigation. Not a shorter cache TTL, not a per-till reservation, not a
signed balance. The invariant in §7.1 is the only defence, and it is why the confirm in §6.3 is
synchronous and mandatory.

### 7.4 Reconciliation on reconnect — the double-issue defence, in layers

**Layer 1 — the idempotency key is a discriminated source key, enforced by the database.**
Odoo POS orders carry a client-generated `uuid` **[STOCK, probe — see §8; it is the single most
load-bearing stock field in this module]**. An earn lot's `source_key` is `'pos:<uuid>'` and the
constraint is `UNIQUE(source_key, program_id)` with **default (distinct) NULL semantics**, backed by
`CHECK (source <> 'earn' OR pos_order_uuid IS NOT NULL)` (§4.8). A replayed sync raises a unique
violation on that named constraint, which the service catches and treats as *"already issued"*.
**The guarantee lives in Postgres, not in application logic**, which means it survives a retry storm,
two workers racing, a restore, and a future refactor by someone who has not read this document.

> **The handler catches ONE constraint, by name.** `except UniqueViolation` over the whole write is
> what turned §4.8's earlier `NULLS NOT DISTINCT` mistake from a loud failure into a silent one: a
> welcome grant that collided with another customer's welcome grant was recorded as "already issued"
> and the customer was never paid. The service matches `diag.constraint_name` against
> `almond_loyalty_point_lot__uniq_issue` **and** re-reads the existing lot to confirm it carries the
> same `source_key` before returning "already issued". Any other integrity error propagates.

**Layer 2 — points are recomputed from the order's own snapshot, not from today's state.**
`pos.order` stores `almond_tier_multiplier_applied`, `almond_earn_base`, `almond_earn_total`,
`almond_channel` — snapshotted **client-side at sale time** — plus `almond_holdout`, which is
**written server-side at sync** by recomputing the §4.11 hash rather than trusting the client (the
hash is deterministic and stable, so the sync-time value equals the sale-time value by construction).
On sync the server recomputes from *those* values, not from the partner's current tier. Otherwise a
customer promoted between the sale and the sync gets paid at the new rate for an old order, and a
demoted one gets paid less than the receipt in their hand says. The receipt is the contract; the
snapshot is what makes it enforceable.

**Layer 3 — divergence is paid, bounded, and reported.**
The server recomputes independently and compares with the client's `almond_earn_total`. If they
differ:

* **Pay the client's number, within the bound below.** The customer holds a receipt.
  **[DECISION]** Silently paying the smaller number is exactly Dunkin' 2022 (BRIEF §4) and exactly
  defect **D2**; it is a trust failure that is discovered publicly, not internally.
* Write the difference to `pos.order.almond_earn_divergence` and raise it in a **daily divergence
  report**. A non-zero divergence rate means the two evaluators in §4.2 have drifted — it is the
  alarm that the golden-vector test was supposed to prevent.
* **Two exclusions, or the report is noise.** A **holdout** order (§4.11) is never a divergence — it
  is the experiment. And a **zero recompute never quarantines**: `recomputed == 0` means "this order
  earns nothing", and multiplying it by any bound gives a ceiling of zero that quarantines every
  legitimate zero-earn order.

**The bound, with numbers, because "3× recomputed" is not a policy.**

**[DECISION]** Honoured divergence is capped in **points per JOD of invoice**, not as a multiple:

```
ABS_CEILING_PTS_PER_JOD = 6          # ir.config_parameter almond_loyalty.abs_ceiling_pts_per_jod
                                     # base is 5 pts/JOD; this honours base + 1 and no more
honoured = min(client_total, recomputed + ABS_CEILING_PTS_PER_JOD * invoice_jod)
```

plus a **per-till daily aggregate cap** (`almond_loyalty.till_daily_divergence_cap`, in points) that
**trips an immediate alert** — not a next-morning report — the moment one till's honoured divergence
crosses it. Above the per-order cap: `state='quarantined'` on the lot and a manual review.

> **Why the earlier rule was unpriced, and roughly what it was worth to an attacker.** `ABS_CEILING`
> had no value anywhere in this document, so `3 × recomputed` was the only live bound — and the earn
> formula runs in the POS browser (§1.4), the least trustworthy tier in the stack, with detection by
> a batch report a human reads the next morning. A point is 1 qirsh and base earn is 5 pts/JOD = 5%
> of invoice value (BRIEF §1), so a manipulated client claiming the bound turns 5% into 15%; on the
> repo's tier ramp (Black ×2.0) legitimate is 10% and the bound is 30%. Per branch:
> 3,238 invoices/day ÷ 8 branches = 405 × 7.16 JOD ≈ 2,900 JOD/day of throughput, so a full
> 10-percentage-point overpay is ~290 JOD/branch/day and ~580 JOD/branch/day at the top tier — for at
> least one full reporting cycle. The JS bundle is served fleet-wide from one server, so the same
> patch reaches all eight branches at once: **~2,300–4,600 JOD/day**.
>
> **[DECISION] The accepted maximum daily exposure is `till_daily_divergence_cap × 8 tills` in
> points, and it must be written into the config with a JOD figure beside it and signed off by
> someone with signing authority before Phase 2 (§10) goes live.** This document deliberately does
> not pick that number — it is a risk appetite, not an engineering constant — but it does refuse to
> ship without one. An unbounded, or unpriced, "trust the client" rule is a compromised-till jackpot.

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
| `loyalty.rule.minimum_amount_tax_mode` | The tax mode of the **`minimum_amount` threshold** — *not* the earn basis (§4.2) | Stable | A qualification threshold evaluated on the wrong side of tax. | Probe; surface the live value in the audit report. **Do not wire `amount_on_tax_basis` from it.** |
| The **earn** tax basis (gross vs net) for `reward_point_mode='money'` | The 8%/16% question; the `amount_on_tax_basis` input in §4.2 | Not a field at all — the configuration does not carry it | 7–15% error in total programme cost. | **Measured, not probed**: `tools/loyalty_audit_live.py:1616 probe_money_mode_tax_basis` derives it from `loyalty.history.issued` vs the source order amounts, and the verdict is stored in `ir.config_parameter almond_loyalty.earn_tax_basis`. |
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
}
# For each model: env[model].fields_get() and assert every name is present.
# Missing 'pos.order.uuid'  -> raise. Anything else missing -> raise with the field named.
#
# res.partner.property_product_pricelist is deliberately NOT here. The pricelist route is
# rejected (§1.2) and read nowhere in §4 or §5; asserting it would refuse the install over a
# field the module never touches. It stays in the §9 probe's report-only section, next to
# loyalty.program.pricelist_ids, where "expected present; NOT used" belongs.
```

### 8.2 The upgrade checklist (put this in the README)

1. Run the §9 probe against the upgraded database **before** installing the module.
2. Diff `models/pos_data_loading.py` against the new `_load_pos_data_*` signatures.
3. Diff every symbol in `static/src/app/patches.js` against the new `pos_loyalty` source.
4. Run the golden-vector test (§4.2) — it is the only thing that proves the two evaluators still
   agree after a JS refactor.
5. Run the **write-protection test** (§4.1): a `group_pos_user` session must still fail to write
   `almond_tier_multiplier`. ORM compute semantics are not a guarantee this module may inherit
   silently across a major version.
6. Run `cron_window_reconcile` manually and confirm zero divergence **on spend and on both visit
   counts**.
7. Confirm `loyalty.card.expiration_date` is still null everywhere.

---

## 9. The probe: verifying every [STOCK] claim before writing code

Nothing in §2 or §8 may be relied upon until it has been read from the live database. The probe is
**read-only**, needs no `APPROVE PROD` token precisely because it writes nothing, and — per
`IMPL-BRIEF.md` — **runs outside this container** (the egress proxy 403s `*.odoo.com`).

`tools/loyalty_audit_live.py` already has the plumbing, and the helpers are named here so the
developer finds them: `load_env()` (line 139), `class Odoo` with the `SAFE_METHODS` allow-list
(lines 102 and 182) that refuses any non-read method before it crosses the wire, and the
capability-detection trio `Odoo.fields()` / `Odoo.has()` / `Odoo.pick()` (lines 223–240). *There is
no `detect_capabilities()` in that file* — that name lives in `tools/loyalty_measure.py:664` and
`tools/loyalty_fraud_scan.py:672` and is the wrong thing to go looking for here.

Walk the manifest with `Odoo.fields(model)` and report through `Odoo.has()` / `Odoo.pick()`,
following the shape of `report_programs()` (line 497). `fields_get` is already in `SAFE_METHODS`
(line 103), so the probe is admissible as-is and needs no change to the safety allow-list. Rather
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
    # Report-only, never asserted at install (§8.1): the rejected pricelist route (§1.2).
    'res.partner?':    {'property_product_pricelist': 'any'},   # expected present; NOT used
}
```

**One ORM-behaviour case that is not a field.** §4.1's anti-self-promotion control must be *tested*,
not assumed: a `group_pos_user` session attempting `partner.write({'almond_tier_multiplier': 2.0})`
and asserting the raise. That case cannot run against production read-only, so it lives in the
module's own test suite (§4.1) and in the §8.2 upgrade checklist — but it is listed here so nobody
mistakes the absence of a probe row for the absence of a claim.

The probe must also answer six **[MEASURE]** questions that decide design parameters this document
deliberately left open:

1. **Which `program_type` and `reward_point_mode` does the LIVE program use today?** The whole
   redesign rests on a verbal claim ("flat 5 points/JOD, tiers are names only") that nobody has
   checked (`IMPL-BRIEF.md` §"Why this exists").
2. **On what basis does `reward_point_mode='money'` actually award — gross or net?** This is the
   8%/16% question made concrete (BRIEF §5) and it moves every cost figure by ~7–15%.
   **The configuration does not carry the answer**, so it is measured, not read:
   `tools/loyalty_audit_live.py:1616 probe_money_mode_tax_basis` compares `loyalty.history.issued`
   against `pos.order.amount_total` and `amount_total − amount_tax`, refuses a verdict below its
   evidence floor, and prints PROVISIONAL below its firm threshold. Its verdict is what populates
   `ir.config_parameter almond_loyalty.earn_tax_basis` (§4.2). Report
   `loyalty.rule.minimum_amount_tax_mode` alongside it — as the **threshold** mode it is, not as the
   earn basis.
3. **Is any `loyalty.card.expiration_date` set?** If yes, §8's trap is already armed and the lot
   ledger cannot be introduced until those are understood. **A "no" is not only good news:** it means
   live points currently never expire, which is the D5 liability §4.8's migration has to price and
   communicate. Report the total point balance and its age distribution with the answer, so the
   §4.8 backfill has its cohort before it runs.
4. **How many distinct partners have a POS order in the last 90 days?** This is `c`, the coverage
   term that every cost estimate in §5.1, §5.7 and §6.4 is linear in — and the only reason those
   sections give formulas rather than numbers. Report the **partner-day count** too: that, not the
   order count, is the bucket-row sizing in §5.7.
5. **How do aggregator (Talabat / Careem) orders land in the live database today?** Which model
   (`pos.order`, `sale.order`, something else), and which of `partner_id` / phone / order reference is
   populated on them. §4.7 marks "these are unearnable" as an **[ASSUMPTION]**; this is the question
   that turns it into a finding or refutes it, and 23% of payment value rides on the answer.
6. **Do all four companies transact in one currency?** §4.1's fleet-wide ladder sums `net_spend`
   across companies; if two companies book in different currencies that sum is meaningless and the
   tier design must change before a line of §5 is written.

---

## 10. Build order

Each phase is independently shippable. **They are not equally reversible, and an earlier draft's
claim that they were is false** — points issued at a wrong multiplier are in customers' hands, and
expired points are gone. The rollback for each is stated explicitly below, because "reversible" was
doing work no mechanism in this document supports. Nothing after phase 0 starts until phase 0's
answers exist.

| Phase | Contents | Gate | Rollback |
|---|---|---|---|
| **0** | §9 probe against the live database. No module code. | Every `[STOCK]` claim VERIFIED or the design revised. `c` measured. The earn tax basis measured (question 2). | Total — nothing was written. |
| **1** | `almond.loyalty.tier`, `res.partner` fields, `§5` window engine, `cron_window_roll` + reconcile. **No earning change** — tiers computed and observed only. | Two weeks of nightly runs, zero reconciliation divergence **on spend and on both visit counts** (§5.6), tier distribution reviewed against the "3–8% top tier" intent (BRIEF §2, review point 2 warns 20–30% will actually qualify). | Total — uninstall drops our tables and columns; no customer was paid differently. |
| **2** | `services/earn.py` + `earn_formula.js` + golden vectors + `pos_data_loading.py`. Multipliers **live**. §4.3 cap and combo. `ABS_CEILING_PTS_PER_JOD` and the per-till daily cap signed off (§7.4). | Zero divergence in the §7.4 daily report **excluding holdout orders** (§4.11). POS timing sampler shows §6 budgets are met, and reports the identification-method mix (§6.4). | **Partial.** Disabling the multiplier stops future mis-issuance; **points already issued are honoured** — reclaiming them is Dunkin' 2022 (BRIEF §4). Price the window: 1,133 member orders/day × 7.16 JOD × 5% base ≈ **405 JOD/day** at ×1.0 and ≈ **527 JOD/day** at an average ×1.3, so a two-week Phase 2 on a wrong multiplier configuration is roughly **7,400 JOD of unrecoverable issuance**. That is the cost of the gate being wrong, and it is the reason Phase 1 observes for two weeks first. |
| **3** | Redemption ladder (stock #6), FIFO lots, the §4.8 legacy backfill, expiry + notices. `cron_expire_points` stays **disabled**. | (a) Liability measured via `tools/loyalty_measure.py section_liability` **before** the backfill. (b) Backfill staggered from last-earn date, first expiry ≥ install + 12 months (§4.8). (c) **Expiry communicated to existing members**, T-30 and T-7 notices delivered to the migration cohort, and the opt-out / complaint rate measured — a member-notice gate, not only a finance gate. (d) `cron_expire_points` runs in **dry-run for one full cycle**, logging what it *would* expire, and that log is reviewed. | **None after the first live sweep** — expired points are destroyed. Everything before it is reversible, which is exactly why the dry-run cycle and the notice gate are mandatory rather than advisory. |
| **4** | Gated rewards: off-peak, tier, availability, channel. Holdout. Birthday. Repricing proposals. `cron_welcome_sweep` enabled only after the §4.9 sign-off. | Holdout arms balanced; the experiment is readable. `WELCOME_POINTS × eligible-partner-count` accepted in JOD (§4.9). | Gating is reversible (flip a flag). Grants are not — see Phase 2's argument. |

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
   parameter. The cost difference is ≤102k vs ≤414k bucket rows at `c = 0.35`
   **[ASSUMPTION, linear in c]**, which is not a reason to choose either.
4. **Demotion depth**: one step per grace (150 days from ذهبي to عضو) vs straight to qualifying
   (120 days). §5.5 states both costs; the number must be chosen deliberately.
5. **`MAX_TIER_MULTIPLIER`'s value.** §4.1 makes the ceiling *reachable* by construction, fixing the
   shape of defect **D1**. Its numeric value is an economics decision, not an engineering one.
6. **`WELCOME_POINTS`'s value, and whether the pre-module partner base gets it at all.** §4.9 ships
   the sweep disabled and requires `WELCOME_POINTS × eligible-partners` in JOD before it is enabled.
   Neither number exists yet.
7. **The accepted daily divergence exposure** (§7.4): `ABS_CEILING_PTS_PER_JOD` is proposed at 6
   (base + 1), but the per-till daily cap — and therefore the fleet's maximum daily loss to a
   compromised POS bundle — is a risk appetite that needs a signature, not a default.
8. **Marketplace earning via customer-supplied proof of purchase** (§4.7). "The aggregator will not
   give us identity" is kept as an **[ASSUMPTION]**; "therefore 23% of payment value is unearnable"
   is *not* established, and §9 question 5 is the first step toward answering it. This document
   hands the question to the design artifact rather than closing it.
9. **Legacy balances: backfill with a staggered expiry, or grandfather as never-expiring** (§4.8).
   §4.8 specifies the backfill and its gates; the choice itself is a customer-offer decision with a
   measurable liability on both sides, and it belongs to whoever owns the offer.
