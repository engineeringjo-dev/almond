# Wiring the Branch filter onto the dashboards (after `almond_branch` installs)

Read-only inspection of the live instance found **3 POS dashboards** that should get a
**Branch** Global Filter. The `almond_branch` module must be installed first (it creates
`branch_id` on `pos.order` and `report.pos.order`); then this is pure UI, no code.

## Targets (by dashboard id / name)
| id | Dashboard | Group | Pivots to field-match | Current filters |
|----|-----------|-------|-----------------------|-----------------|
| **48** | **ساعة بساعة** | داشبورد الافرع اليومي | 3 pivots on `report.pos.order` | date only → **add Branch** |
| 58 | Point of Sale | Sales | 6 pivots on `report.pos.order` + 1 list on `pos.order` | date, Session, Point of Sale, Responsible, Product → **add Branch** |
| 5 | POS - Restaurant | Sales | 3 on `pos.order` + 4 on `report.pos.order` | date, Product Category, Product, Waiter → **add Branch** |

> #48 «ساعة بساعة» is the **daily branches dashboard** and today has no branch filter —
> it is the primary target. #58 already filters by *Point of Sale* (a single shop), which
> is exactly what can't group the pairs; the Branch filter is the upgrade.

## Steps (do on a dev/staging copy first)
For **each** dashboard above:
1. Open the dashboard → **Edit** → **Filters** (top bar) → **Add a filter** → **Relation**.
2. **Related model** = **Branch** (`almond.branch`). Label it `الفرع` / `Branch`.
3. Odoo shows every pivot/list on the dashboard and asks which field links to Branch.
   For **every** pivot/list whose model is `pos.order` **or** `report.pos.order`,
   pick the field **`Branch` (`branch_id`)**. (After install it auto-suggests, because
   `branch_id` is a real field on both models.)
4. Leave pivots on other models (e.g. account.*) unmatched — they simply ignore the filter.
5. **Save**.

Result: a **Branch** dropdown appears; picking e.g. *Mecca Street* includes **both**
"Mecca Street" and "Mecca Street 2" in one click (the pair merge lives in the branch map).

## Verify
- Pick one branch that is a pair (e.g. *Mecca Street*) → totals ≈ sum of the two shops.
- Pick a single-shop branch (e.g. *Khalda*) → equals that shop alone.
- Combine with the existing **date** filter → both apply together.

## Notes
- Editing a dashboard is a **WRITE**. Do it on staging (`test-recipes2`) first; production
  is a separate, explicit step.
- No measure/pivot definitions change — we only **add** a filter and its field-matching.
- If a pivot is built on `pos.order.line`, match Branch via `order_id` → `branch_id`
  (none of the three dashboards above need this; noted for completeness).
