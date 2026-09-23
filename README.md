# Almond Coffee House ☕

Loyalty programme, ordering website and member app for a Jordanian coffee-house
chain, alongside an Odoo 19 ERP that remains the source of truth for the menu,
sales and stock.

> **Handing this over, or picking it up?** Read
> **[`docs/HANDOVER.md`](docs/HANDOVER.md)** first. It states plainly what is
> live, what is mocked, and what has not been built — including two gaps that
> prevent going live at all. This file tells you how the code is laid out; that
> one tells you what is true.

---

## Layout

Four npm workspaces. All four share one package, and that is the point: the
loyalty rules are written once and imported everywhere, so the phone, the
website and the server cannot pay a member three different answers.

```
almond/
├── packages/shared/   # THE RULES. Points, tiers, expiry, discounts, the menu,
│                      #   money formatting, types. Pure, no I/O, heavily tested
│                      #   (through bff/test). Everything else imports this.
├── bff/               # Fastify API. Members, points, wallet, redemptions, the
│                      #   corporate register, POS tokens. Holds every secret.
├── almond-web/        # Next.js 15 website — menu, ordering, and the back
│                      #   office at /admin. Deploys to Vercel.
└── almond-app/        # Expo (SDK 56) member app. Ships as a WEB build today
                       #   (GitHub Pages, base path /almond); no native build
                       #   pipeline exists yet.
```

Supporting directories: `docs/` (specifications and decision records),
`scripts/` (the Odoo menu pull), `supabase/migrations/` (database schema),
`integrations/` (Odoo add-ons), `tools/` (one-off HTML utilities).

---

## Running it

```bash
nvm use            # .nvmrc — Node 22. The workflows read the same file.
npm ci             # the lockfile exactly; never `npm install` in CI

npm run typecheck                   # all four workspaces
npm test --workspace @almond/bff    # 397 tests
npm test --workspace almond-app     # 109 tests
npm run web:build                   # the website
```

Two terminals to run the whole thing:

```bash
# 1 — the API. Works with no configuration at all: it keeps everything in
#     memory, which is right for development and forgets on restart.
npm run dev --workspace @almond/bff          # :8080

# 2 — the website.
npm run dev --workspace almond-web           # :3000
```

The member app: `npm run web --workspace almond-app`.

Copy `bff/.env.example` and `almond-web/.env.example` to `.env` / `.env.local`
and read the comments — each variable says what breaks without it, and several
say why a tempting default would be a security hole rather than a convenience.

---

## The two switches that decide what is real

| Variable | Where | Unset means |
|---|---|---|
| `DATA_SOURCE` | both | `mock` — the MENU and prices come from the committed export. `odoo` is not wired end to end. |
| `DATABASE_URL` | `bff` | in-memory — members, points and the corporate register are **forgotten on restart**. Set it to Postgres and the same behaviour persists. |

They answer different questions — one is where the menu comes from, the other
is where members are kept — and conflating them is how `DATA_SOURCE=odoo` came
to mean "throw on every call".

---

## The menu comes from Odoo, by hand

```bash
ODOO_URL=… ODOO_DB=… ODOO_LOGIN=… ODOO_API_KEY=… npm run menu:pull
```

Read-only. It rewrites `packages/shared/src/menu/menu.generated.ts` and 306
WebP photographs under `almond-web/public/menu/` and `almond-app/public/menu/`,
so it produces a **commit**, not a deployment. Deliberately manual: an
automatic pull that writes to the repository unreviewed would publish an Odoo
mistake — an item priced at zero, a missing name — straight to customers.

---

## Conventions worth knowing before you change anything

- **One rule, one implementation.** If a number can be computed in two places,
  it is computed in `packages/shared` and imported. The commit history is a
  record of what happened when that was violated.
- **Money is integers where it is stored** (fils), and formatted in one place.
- **Guards are tested by breaking them.** Several suites exist to fail when a
  specific safety property is removed; the commit messages name which.
- **Arabic is the primary language.** Every user-facing string is in both
  `ar.json` and `en.json`, and RTL is the default layout, not an afterthought.
- **Commit messages carry the reasoning.** They are long on purpose: most of
  the "why" for a surprising decision is in the commit that made it, not in a
  separate document that would have drifted.
