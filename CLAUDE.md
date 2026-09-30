# CLAUDE.md — Almond loyalty app, website and server

Claude Code reads this file at the start of every session. It is short on
purpose: the detail is in [`README.md`](README.md) and
[`docs/HANDOVER.md`](docs/HANDOVER.md).

## The first rule: study how those before us solved it

GM, 2026-09-30: «دائما اسهل طريقة للحل هي دراسة كيف نفذ من سبقونا».

Before designing any solution, look at how proven products and standards
already solve the same problem:

- **Ordering, menus, carts, loyalty:** Careem, Talabat, Starbucks, Uber Eats,
  Deliveroo.
- **Platform behaviour:** Apple HIG, Material 3, WAI-ARIA Authoring Practices,
  NN/g.
- **Odoo:** its own modules and documentation.

Follow the established pattern unless there is a stated reason not to. Write
that reason in the commit message, and name the precedent there too
("Precedent: Starbucks does X").

## Rules that are already enforced

- **One rule, one implementation.** A rule the app, the website and the server
  all need lives in `packages/shared`.
- **Arabic is primary.** Every string goes in both `ar.json` and `en.json`, and
  RTL is the default.
- **Test a guard by breaking it.** Break it on purpose, confirm the test fails,
  then restore it byte-for-byte.
- **Run the full gate before any merge to `main`:** `npm run lint`,
  `npm run typecheck`, the bff, app and web tests, the Python addon tests,
  `npm run web:build`, and `CI=1 npm run test:e2e`.
- **Interface work uses the design skills** in `.claude/skills/`
  (`impeccable`, `design-taste-frontend`, `emil-design-eng`). They run in
  advisory mode and carry no scripts. Read `impeccable/reference/craft-floor.md`
  before any UI edit. See `.claude/skills/WEB-DESIGN-SKILLS.md`.
- **The menu comes from Odoo** and is read-only: `npm run menu:pull` and
  `npm run menu:insights`. It is synced daily and reaches the app without a
  store release. See `docs/PUBLIC-MENU-FEED.md`.
- **Secrets never go in the repo or a client bundle.** No secret behind
  `NEXT_PUBLIC_` or `EXPO_PUBLIC_`. Any write to production Odoo waits for
  explicit approval from the owner.
- **In this environment, never kill processes by pattern** (`pkill`, `pgrep`,
  `killall`). Record the PID when you start a process and stop it by that PID.
