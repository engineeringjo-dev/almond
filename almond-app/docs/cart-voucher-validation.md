# Cart editing and voucher handoff — 2026-10-16

Scope: edit an existing configured cart line, and open the credit voucher
returned by a points redemption. Direction A remains the visual foundation.
No loyalty, earning, pricing, payment, menu or POS contract was changed.

## Behavior

- Edit opens the saved size, choices and quantity as a local draft. Cancel,
  sheet dismissal and reopening preserve the actual cart until Save.
- Save resolves the current menu and updates the cart atomically. The source
  line must still exist with its original quantity. Identical configurations
  combine quantities; separate pairings remain separate lines.
- Missing products, sizes and choices remain explicit recovery states. An
  unseen price change rejects Save until the current quote can be reviewed.
- Confirmation names the exact shared points option and credit voucher value.
  Success opens the returned voucher ID and focuses that actual voucher.
  A missing link offers retry instead of silently selecting a different card.
  Web/iOS navigation waits for the outgoing Modal's actual dismissal so its
  focus trap cannot take focus back; Android uses its supported direct path.
- Voucher cards show their supplied expiry and the actual service mode.
  Mock vouchers explicitly say they are previews and cannot be used to pay.
  Odoo-mode vouchers say they are not ready because no redemption code is
  supplied by the current app contract.

## Integration boundary

The app's `Voucher` has an ID, bilingual title, type, optional value, expiry
and used flag. It has no POS credential or redemption-method contract. The
BFF's separate `RedemptionView` and short-lived QR endpoint are not consumed
by this app service. Voucher IDs are never rendered as spend codes or QR
payloads. Issuing a voucher does not apply a discount to a cart or invoice.
This work does not enable production redemption.

## Review and verification

A separate read-only reviewer checked cart atomicity, cancellation, menu
changes, pairings, checkout preferences and the voucher contract. Its merge
repricing finding required a visible destination quantity/price/total review
before saving a collision; the implementation and focused evidence are
reviewed before release.

Runtime inspection found that immediate navigation let the outgoing web
Modal's focus trap reclaim focus. Both handoff E2Es and all six phone
inspection cases reproduced it before the fix. Navigation now waits for the
real dismissal event, with focus attached to the selected card's actual
mount on the active route. The fresh six-case inspection passed with focus
retained; the independent reviewer also checked the lifecycle source change.

The implementation agents deliberately broke and restored the cart and
voucher guards. Root coordinates the final static, unit, addon, build and
browser gates and the exact-head GitHub CI check before merging.

| Final-source local check | Result |
|---|---|
| Repository lint and type checking | Passed |
| Unit suites: BFF / app / website | 871 / 505 / 244 passed (1,620 total); existing 3 skips and 1 todo retained |
| Python POS addon tests | 40 passed |
| Website production build and app web export | Passed |
| Full exported-app browser suite after the lifecycle fix | 59 passed |
| Phone inspection: 320 / 390 / 412px, Arabic/English, light/dark | 6 journeys passed; 18 captures; visible merged total, reachable Save, focused returned voucher, no page errors or horizontal page overflow |

The standard local full E2E launcher was blocked by this host's Unix socket
and network-interface restrictions before tests could run. A temporary
loopback BFF launcher progressed to the website launcher, which hit the same
network-interface restriction. Repository launch commands were not changed.
The exported-app browser suite runs separately here; the unchanged full
E2E/accessibility/RTL gate must pass on GitHub for the exact commit before
merge.

Browser evidence uses the exported app, mock services and a synthetic member.
Phone viewport/touch emulation does not establish native Android/iPhone,
Safari, OS text scaling, VoiceOver/TalkBack, physical scanning, production POS
or payment behavior. WebKit installation succeeded, but this host cannot
launch it because required system libraries are missing. No live Odoo writes
or real payments were made. No sales, margin, repeat-purchase or task-time
improvement is claimed.
