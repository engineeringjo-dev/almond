# Loyalty safety review — 2026-10-16

Scope: development BFF, shared loyalty rules, app mock and customer copy.
The BFF is not hosted and the migrations have not been applied to a production
database. These changes are implementation evidence, not a claim that live
money flows already use the new protections. No production Odoo writes or
actual payments were made.

## Confirmed issues and resulting rules

| Evidence | Impact | Implemented rule | Priority / success check |
|---|---|---|---|
| Repeated referral rewards had no per-inviter points budget. | Unbounded promotional liability across many referred accounts. | Lifetime budget of 500 gross awarded points per inviter, enforced under the inviter lock; the last reward may be smaller. Spending, expiry, refunds, deletion and rejoining do not replenish it. | P0: repeated and concurrent eligible first purchases never award more than the remaining budget. |
| A stored/imported Jordanian phone was treated like verified ownership. | Reward eligibility could rely on an unproved phone number. | Both canonical Jordanian mobile numbers require durable successful OTP proof at attachment and settlement. Legacy/imported/demo records receive no invented proof. | P0: missing, foreign, changed and unverified phones fail closed. |
| Zero-paid checkout could settle welcome/referral gifts. | A fully discounted order could trigger a paid-purchase promotion. | Finite positive actual payment is required. No new minimum ticket size was invented. | P0: zero and invalid payment grant neither paid-purchase gift; genuine positive payment preserves existing eligibility. |
| Cancelling or sweeping an unused redemption granted a fresh points lot. | Reserving points repeatedly could renew their expiry indefinitely. | Store the original FIFO slices and restore only their still-live value with original expiry. Unknown legacy slices require reconciliation rather than a guessed new entitlement. | P0: expiry, mixed slices, repeated cancel, restart and sweep preserve value and dates exactly once. |
| Reserve points, refund the originating sale, then cancel the reservation. | A later cancellation could restore points already owed back after the refund. | Refund closes pending reservations atomically before reversal; remaining purchase-point shortfall persists and offsets future positive point credits. Proven expired unused value from the same purchase, including original lots and cancelled reservations or reversed POS point tenders, receives an exact, non-repeatable exemption. | P0: refund/cancel races, transfers, gifts, future purchases, restart and rollback cannot recreate the shortfall. |
| A redemption QR selected the latest redemption at settlement. | Cancelling A and creating B could redirect A's credential to B. | Sign and resolve the exact member, purpose and redemption ID; reject expired and old unbound credentials. | P0: A can never settle B; reject at the exact expiry boundary. |
| Eight whole-cake products reuse `L` for several sizes; selecting the visible 25-person / 50 JOD choice repriced as 15-person / 30 JOD. | The larger choice was unrepresentable and the order could silently change size. Actual higher-value fulfilment for a lower charge was not proved. | One shared exact-match resolver refuses unknown or ambiguous sizes. Both configurators disable those choices; checkout refuses before payment, and saved orders validate atomically before adding anything. Safe S/M choices remain available. | P1: the actual cake example refuses, wallet stays unchanged, and an invalid reorder preserves the current cart without partial additions. |

## Customer-visible meaning

- Referral is inviter-only, after the friend's first eligible positive-paid
  purchase. Self-referral and same-phone referral are refused; corporate
  eligibility remains governed by the existing rules.
- The published ceiling is lifetime, not a monthly reset. Gross awarded
  referral points remain in immutable history even if a later points credit
  settles an earlier purchase-point shortfall.
- Purchase-point recovery changes points only. It does not debit the wallet,
  charge a cash fee or deduct from the customer's cash refund. All positive
  point credits, including gifts and returned unused reservations, first
  settle outstanding purchase-point shortfall.
- An actual net 50-point profile reward with zero recovery opens the Almond
  illustration. Recovery receives explicit native copy with the actual net
  amount; gross entitlement alone never triggers a misleading celebration.
- The public app page `/profile/policies` explains these rules. Invitations
  offer WhatsApp and copying the actual invitation link, with manual recovery
  if clipboard access fails. Opening a share action itself earns no points.

## Limits requiring integration work

- The 120-second redemption credential is a configurable presentation
  lifetime. The legacy typed-code POS handoff still has its underlying
  15-minute lifetime; this is not end-to-end 120-second settlement. The
  current app voucher contract remains unavailable for actual POS spending.
  See [voucher-barcode-policy.md](voucher-barcode-policy.md).
- In-process replay tracking is not a distributed nonce store. Database
  same-row settlement protects the financial operation, while multi-instance
  production rollout still requires the documented distributed controls.
- An already-consumed benefit transferred to another member cannot be
  magically recovered from that unrelated member. The originating account's
  outstanding purchase-point shortfall is retained for future credits.
- The existing invitation URL has no verified automatic landing/deep-link
  attribution handler. The shared message preserves the actual manual code;
  copying a link is not proof that attribution completed.
- Old shortfalls or unknown lot lineage are reconciliation work. The code
  does not invent provenance or silently backfill a legacy debt balance.
- Re-enabling ambiguous larger cake sizes requires genuine Odoo attribute
  identities to survive importer, menu, cart and fulfilment contracts. This
  change does not invent those discarded identities or rewrite generated menu
  data. The current Odoo checkout adapter remains an integration stub.
- The existing paid-purchase promotion rules have no minimum above a positive
  actual payment, and keep welcome/referral gifts after returns. Consequently
  a small positive payment can still qualify; phone proof and the inviter's
  500-point budget do not establish a global promotion budget or prove one
  human per account. This implementation preserves those existing commercial
  rules. A minimum qualifying net payment, refund-dependent gift eligibility
  or a programme-wide budget would be an additional policy decision before a
  real-money launch.

## Migration handoff

The three new files were scaffolded with the official Supabase CLI and filled
with the reviewed SQL. Test schema loading follows chronological filenames:

- `20261016160147_referral_security.sql`
- `20261016160212_redemption_slices.sql`
- `20261016160234_purchase_points_recovery.sql`

Apply the complete migration history in order before deploying a matching
BFF. Existing unproved phone ownership stays unproved; legacy unknown slices
and shortfalls are marked for reconciliation. No production migration was
applied during this work.

## Verification

The Node 22 source-freeze gate passed: clean lockfile installation, whole-repo
lint and typecheck, 1,835 passing JavaScript tests (976 BFF, 610 app, 249
website), 40 Python POS-client tests, the website production build and the
Expo web export. Five BFF tests were explicitly skipped and one remains a
todo; these are not counted as passing.

The local mobile Chromium run covered 80 distinct app journeys. Its three
initial failures exposed rapid carousel navigation and an invalid web
birthday autocomplete token; both were fixed. A 15-test affected-path rerun
passed, including all three failures, touch swipes and resize in both
languages, calendar/manual birthday input, and the real mock-service profile
grant followed by a repeat save. The latter verifies that the 50-point artwork
fits the viewport, dismissal returns to the profile, and the repeat save does
not celebrate again. Rating tests map each Latin numeral to its own star in
Arabic and English at 320 px. No test issued a real WhatsApp message.

Visual capture covered all seven campaign slides in Arabic and English,
light and dark mode, at 320, 390 and 412 CSS px: 84 slide captures plus 12
home captures, without horizontal document overflow. The final Expo bundle
at this checkpoint is `entry-b1f25f82f4a0edc7e46254de3792a10f.js`.

The local environment could not run the combined website/BFF/app Playwright
launcher because of its IPC/network-interface restrictions. The complete
GitHub CI gate must pass on the exact proposed head before merge; these local
app results do not substitute for that gate.

Physical Android/iPhone, native screen readers, physical scanners, live SMS,
live payment and production Odoo operations require separate verification.
The conditional multi-connection Postgres suite requires
`ALMOND_TEST_PG_URL`; embedded PGlite tests are not evidence that it ran.

## Reference basis

OWASP Transaction Authorization recommends server-enforced, operation-bound,
short-lived authorization. Google Wallet documents rotating barcode validation
and the weakness of a longer-lived static fallback. Neither mandates 120
seconds. Starbucks US Rewards Terms dated 2026-03-10 provide a relevant
precedent for deducting purchase points after voids/returns; Almond's exact
points-only recovery and promotional rules remain its own policy.

- https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html
- https://developers.google.com/wallet/generic/resources/rotating-barcodes
- https://www.starbucks.com/terms/rewards/
