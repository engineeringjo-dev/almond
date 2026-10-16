# Almond members' app

Almond Coffee House customers use the app to show their membership code at
the till, reorder, browse and configure products, assemble a basket, select a
branch, and understand and redeem their loyalty benefits. Arabic is primary;
English and both appearance schemes are supported.

The current shipped client is the Expo web export under `/almond`. Native
iPhone and Android releases are not shipped. Local review uses the existing
mock services and a synthetic signed-in member; demo balances are not defects
or evidence of production transactions.

Product and loyalty truth lives in `packages/shared`: menu, pricing, points,
tiers, expiry and redemption. The UI must display those rules rather than
introduce a second implementation. The repository's launch blockers and
production access boundaries remain in `docs/HANDOVER.md` and
`docs/HANDOFF-CODEX.md` at the repository root.

The owner selected visual direction **A — Daylight Counter** on 2026-10-16
after comparing three directions on the same five screens. Keep Almond's
real logo, bilingual Helvetica Neue Arabic and existing white-background
product photography. Preserve the neutral identity, with one warm reward
accent. Visual changes must keep existing ordering and loyalty behavior.

Evaluate task completion, time, errors and return purchases; commercial
impact and margin require measured experiments, not visual-review claims.
