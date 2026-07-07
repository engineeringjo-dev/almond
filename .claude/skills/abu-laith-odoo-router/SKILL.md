---
name: abu-laith-odoo-router
description: >-
  Abu Laith — the SINGLE entry point and router for ALL Odoo 19 work on the
  Almond project. Invoke FIRST for any Odoo task (understand a live instance,
  write/scaffold a model/view/security/OWL/report, quick syntax question, review
  a change, prep a deploy/PR gate, migrate 14→19). Classifies the intent and
  routes to exactly one skill/command (tuanle introspection+gates OR the ignify
  Odoo-19 writing reference), enforcing the pipeline and the dev/prod guardrails.
  All Odoo sub-skills are invoke-only; Abu Laith decides which runs and when.
---

# Abu Laith — Odoo 19 Skill Router (Almond)

**Governing idea:** Abu Laith is the ONLY thing that decides which Odoo skill
runs and when. Every Odoo sub-skill is **invoke-only** (never auto-fires), so
there is no collision and no wasted context. Any Odoo request routes through
here first: classify intent → route per the table → enforce the guardrail.

## 0) Golden rules
- Any Odoo 19 request passes through Abu Laith first.
- **No skill connects to any server/DB except on an explicit, named instruction.**
- Default read target = branch **`dev-almond`** with a **read-only** DB user.
  Production **`ag-almond-coffee-house-master1`** is locked behind a literal
  typed token **`APPROVE PROD`** from Hamza in the same session.

## 1) Registry (roles are fixed)
| Skill / tool | Role | How to invoke |
|---|---|---|
| **tuanle — `odoo-ai-skills` (plugin v0.14.0)** | Truth + gates: read reality from the live instance (fields, MRO, views, security, runtime), review, deploy gate. Ships the **no-introspect-no-edit** PreToolUse hook. | Commands `/odoo` (introspect), `/odoo-review`, `/odoo-gate`, `/odoo-ai` + its own skills (odoo-introspect, odoo-security, odoo-owl, …) |
| **ignify — `odoo19-module-development` (skill)** | Writing reference: correct Odoo 19 syntax (models/fields/views/security/OWL/reports/migration). No server connection. | Read its `references/odoo-19-*.md` on demand |
| *(third slot — narrow only)* | Migration 14→19 or Almond-specific business rules | Invoked only for its narrow intent (§6) |

> **Superseded:** `odoo-module-builder` was removed — ignify covers general
> Odoo 19 authoring more completely and is invoke-only. Do not reintroduce a
> second general authoring skill (anti-collision, §5).

## 2) Decision table (Intent → Route → Guardrail)
| Intent | Route | Guardrail |
|---|---|---|
| "understand current state / which fields / why X breaks / impact of a field change" | tuanle `/odoo` (introspect) | `dev-almond` · read-only |
| "write/scaffold a module/model/view/security/OWL/report" | ignify references (v19 syntax) | author on `dev-almond` |
| "quick syntax Q (decorator, field attr, `<list>` vs `<tree>`)" | ignify reference only | no connection |
| "review my change / is it safe / bad patterns" | tuanle `/odoo-review` | static + patterns |
| "prep PR / pre-merge gate / deploy readiness / evidence" | tuanle `/odoo-gate` | evidence bundle |
| "migrate/upgrade a module 14→19" | ignify `references/odoo-19-migration.md` (or the migration skill) | on `dev-almond` |
| "deploy to server" | tuanle deploy gate → **human approval**; dev/staging first | **never** auto on prod |

## 3) Mandatory pipeline (any code change)
```
1) introspect  → tuanle /odoo         (read truth from dev-almond)
2) author      → ignify references    (write correct v19 syntax)
3) review      → tuanle /odoo-review   (patterns + bugs)
4) gate/tests  → tuanle /odoo-gate     (evidence bundle before PR)
5) approve     → explicit Hamza approval
6) deploy      → dev/staging first; prod only with APPROVE PROD
```
Don't skip a step. tuanle's hook blocking edits before step 1 is a feature.

## 4) Environment policy
- Default: all reads/introspection on `dev-almond`, read-only user.
- Prod `ag-almond-coffee-house-master1`: no read/write without typed `APPROVE PROD`.
- Deploy: separate, human-approved; never inferred. Echo the exact command +
  target host/DB and wait for confirmation.
- **This remote container has NO live Odoo instance.** tuanle introspection
  steps run only in the real dev environment where `dev-almond` is reachable.
  Here, Abu Laith still routes and ignify authoring still works offline.

## 5) Anti-collision
- ignify is invoke-only (won't auto-fire on `.py/.xml`); Abu Laith chooses when.
- tuanle works via commands + hook (no passive trigger).
- One role per task: if two skills seem to fit one intent, pick the table's
  role-owner and ignore the other.

## 6) Third-slot policy
- Migration/upgrade → role: "migrate 14→19" only.
- General Odoo 19 dev overlapping ignify → **disable it** (never two for one role).
- Almond-specific business logic → role: Almond rules only; invoked after ignify.

## 7) Install / layout (for the human to complete)
```bash
# ignify (writing reference) — already vendored here:
#   .claude/skills/odoo19-module-development/  (SKILL.md + references/)

# tuanle plugin (commands + hook + its skills) — vendored at
#   .claude/plugins/odoo-ai-skills/  — install it (interactive) with:
/plugin marketplace add ./.claude/plugins/odoo-ai-skills
/plugin install odoo-ai-skills@odoo-ai-skills
# Pin: tuanle 0.14.0.
```

## Definition of done
- [ ] Abu Laith is the only entry for Odoo tasks; no sub-skill auto-fires.
- [ ] Every task routed per §2; every code change follows §3 in order.
- [ ] All reads on `dev-almond` read-only; prod behind `APPROVE PROD`.
- [ ] No second general authoring skill besides ignify.
