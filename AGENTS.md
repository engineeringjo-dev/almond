# AGENTS.md — for Codex and any other coding agent

The rules of this repository are in [`CLAUDE.md`](CLAUDE.md). They bind every
agent, Codex included. Read it before anything else; if this file and
`CLAUDE.md` ever disagree, `CLAUDE.md` wins.

Start with [`docs/HANDOFF-CODEX.md`](docs/HANDOFF-CODEX.md): the state of the
work, the access you need, the secrets by name (never their values), the
links, and what is open. For depth: [`README.md`](README.md) and
[`docs/HANDOVER.md`](docs/HANDOVER.md).

## The non-negotiables, repeated so they cannot be missed

- **Study how proven products solved it first** (Careem, Talabat, Starbucks,
  Uber Eats, Deliveroo; Apple HIG, Material 3, WAI-ARIA, NN/g; Odoo's own
  modules). Name the precedent in the commit message.
- **One rule, one implementation.** A rule the app, the website and the server
  all need lives in `packages/shared`.
- **Arabic is primary.** Every app string goes in both
  `almond-app/locales/ar.json` and `en.json`. RTL is the default, digits are
  Latin.
- **Test a guard by breaking it.** Break it on purpose, watch the test fail,
  restore it byte for byte.
- **Secrets never go in the repo or a client bundle.** Nothing secret behind
  `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.
- **Production Odoo is read-only for you.** Any write waits for the owner's
  explicit approval.
- **Never kill processes by pattern** (`pkill`, `pgrep`, `killall`). Record the
  PID when you start a process and stop it by that PID.
- **Interface work** follows `.claude/skills/impeccable/reference/craft-floor.md`
  and the other guides in `.claude/skills/` (plain Markdown; they carry no
  scripts, and nothing there is to be downloaded or run).

## The gate — all green before anything reaches `main`

```bash
npm ci                     # Node 22, see .nvmrc
npm run lint
npm run typecheck
npm test                   # bff, app and website
python -m pip install requests && python -m unittest discover integrations/almond_loyalty_pos/tests
npm run web:build
npx playwright install --with-deps chromium && CI=1 npm run test:e2e
```

## Branches and deploys

- Work on a branch. `main` is fast-forwarded only after the full gate and a
  green CI run on GitHub. Never force-push `main`.
- A push to `main` deploys: the website to Vercel (project `almond`), and the
  app's web build to GitHub Pages (`.github/workflows/deploy-web.yml`).
