# odoo-module-builder

A portable Claude Code / Claude Agent skill for scaffolding new Odoo modules
(targeting 19.0, applicable back to 17.0) the standard way. Every pattern in
`references/` is copied verbatim from the official
[`odoo/odoo`](https://github.com/odoo/odoo) GitHub repo (branch `19.0`), with
the source path cited, rather than invented from memory.

## What's inside

```
odoo-module-builder/
├── SKILL.md                          # entry point: workflow + lookup table
└── references/
    ├── module-structure.md           # manifest, folder layout, data load order
    ├── models.md                     # model definition, constraints, cron methods
    ├── views-search-filters.md       # list view, search view, filters, group-by
    ├── form-views.md                 # form view, header buttons, statusbar, chatter
    ├── cron-jobs.md                  # ir.cron examples
    ├── server-actions.md             # ir.actions.server + object-type buttons
    ├── security.md                   # groups, ir.model.access.csv, record rules
    └── checklist.md                  # pre-flight checklist
```

## Install

**Recommended — via the [`skills` CLI](https://github.com/vercel-labs/skills)**,
which installs into any of 70+ supported agents (Claude Code, Cursor, Codex,
OpenCode, ...):

```bash
npx skills add minaonlyone/odoo-skills --skill odoo-module-builder

# target a specific agent, or install globally
npx skills add minaonlyone/odoo-skills --skill odoo-module-builder -a claude-code
npx skills add minaonlyone/odoo-skills --skill odoo-module-builder -a antigravity
npx skills add minaonlyone/odoo-skills --skill odoo-module-builder -g
```

**Manual copy** (no CLI, Claude Code specifically):
```bash
cp -r odoo-module-builder ~/.claude/skills/odoo-module-builder        # personal
cp -r odoo-module-builder /path/to/project/.claude/skills/odoo-module-builder  # project
```

Any other skill loader can also just copy the `odoo-module-builder/` folder
directly — it's self-contained with no dependency on this repo.

After installing, the skill is picked up automatically; invoke it by asking
to create/scaffold an Odoo module, or explicitly via `/odoo-module-builder`
if your agent supports slash-invoking skills by name.

## Updating the reference snippets

The snippets are pinned to a specific commit on the `19.0` branch (noted in
`SKILL.md`). To refresh against upstream:

```bash
git clone --depth 1 --branch 19.0 --filter=blob:none --sparse \
  https://github.com/odoo/odoo.git /tmp/odoo19
cd /tmp/odoo19
git sparse-checkout set --no-cone addons/utm addons/project addons/mail addons/crm
```

Then diff the relevant `addons/...` files against what's quoted in
`references/*.md` and update as needed.
