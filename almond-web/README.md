# Almond Coffee House — Website (`almond-web`)

Bilingual (**Arabic-RTL default / English-LTR**) e-commerce + loyalty site that
mirrors the mobile app: the real menu, ordering, and the **same beans/points +
wallet account** as `almond-app/`. Built per [`docs/WEBSITE-HANDOFF.md`](../docs/WEBSITE-HANDOFF.md).

## Stack

- **Next.js 15 (App Router) + TypeScript (strict)**
- **Tailwind CSS** — brand tokens wired to the shared theme via CSS variables
- **next-intl** — `ar` (default, RTL) and `en` (LTR); `dir`/`lang` set per locale
- **TanStack Query v5** + **Zustand** (same data tools as the app)
- **`@almond/shared`** — the single source of truth (types, theme, menu, loyalty
  constants, format). Never duplicate these; import them.

## Data source switch

Everything runs on a **mock** layer (the real Talabat menu from `@almond/shared`)
so the site is fully demoable offline. Flip to the live Odoo/loyalty backend with
one env var — nothing else changes:

```bash
NEXT_PUBLIC_DATA_SOURCE=mock   # default
NEXT_PUBLIC_DATA_SOURCE=odoo   # go live
```

See `src/lib/config.ts`.

## Develop

From the repo root (npm workspaces):

```bash
npm install                 # installs the whole monorepo
npm run web:dev             # next dev   (http://localhost:3000)
npm run web:build           # next build
npm run web:typecheck       # tsc --noEmit
```

Arabic is served at `/`, English at `/en`.

## Structure

```
src/
  app/[locale]/        layout (html dir/lang, fonts, theme vars) + pages
  components/          Header, Footer, ui/, home/ sections
  i18n/                next-intl routing / request / navigation
  messages/            ar.json · en.json
  data/                menu, featured, branches (mock → odoo)
  lib/                 config (DATA_SOURCE), format, cn
  theme/               CSS-variable bridge to @almond/shared/theme
```

## Theme (single source of truth)

The violet palette and gradients come from `@almond/shared/theme`. At render time
`src/theme/cssVars.ts` injects them as CSS custom properties on `<html>`, and
`tailwind.config.ts` maps tokens (`bg-primary`, `bg-gradient-rainbow`, …) to those
variables — so the web can never drift from the app's identity.
