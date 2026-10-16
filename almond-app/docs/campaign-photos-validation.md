# Almond campaign photography — 2026-10-16

Scope: the owner's real brand/product photography, a price-free combo
campaign, catering contact, a branded Order now action and a familiar
coin/return cashback icon. Direction A and all earning/pricing rules remain
in place. No dependencies, payment, production Odoo or wallet logic changed.

## Decisions and provenance

The owner chose the visible English badge `Cash back` / `50 points`, including
in the Arabic app. It is native text over the photo, translated in both
locale files with `{{points}}` from `COMBO_BONUS_POINTS`; it is not burned into
the artwork or hardcoded to today's dial. The red uses existing theme tokens
on opaque theme paper. Arabic names the offer **كومبو ألموند**.

| Project asset in `assets/campaigns/` | Owner-supplied source | Processing |
|---|---|---|
| `combo-americano-cookie.jpg` | `01-1000708926.jpg` | Imagegen edit removes old poster text/3.90 price/badge; whole cup + food in a 3:2 frame |
| `combo-americano-croissant.jpg` | `02-1000708925.jpg` | Same cleanup of the old 4.50 poster |
| `combo-americano-egg-bagel.jpg` | `03-1000708924.jpg` | Same cleanup of the old 4.50 poster |
| `combo-americano-cheese-bagel.jpg` | `05-1000708922.jpg` | Same cleanup of the old 4.50 poster |
| `almond-iced-cup.png` | Original cookie poster and its cleaned derivative | Imagegen transparent cutout; resized to 593×768; real alpha including transparent corners |
| `cafe-coffee-pastry.jpg` | `04-1000708921.jpg` | Unchanged original café photograph |
| `minis-catering.jpg` | `07-1000708909.jpg` | Unchanged minis spread; duplicate 10 not bundled |

Original uploads were not edited. The four cleaned photographs and cup are
derivatives reviewed against their source; they are not untouched originals.
JPEG derivatives use quality 88/mozjpeg encoding; cup PNG is optimized. The
seasonal poster and product contact sheet were not used as current offers.
Seven used files total about 2.1MB; all are bundled static assets.

The Expo reviewer and independent flow reviewer chose the cup for the broad
**Order now** action; photographed pairs describe only the combo. The cup
fits the existing 72pt action with contain sizing, no circular mask/zoom.
A nonempty basket still shows its own first item, count and total and opens
the actual cart.

## Journeys and rule boundaries

- Home keeps membership/Order now first, then the usual order. A stationary
  combo entry opens `/campaigns`; no autoplay and no implicit basket additions.
- The campaign shows all four whole photographs in one column on phones;
  two columns require at least 700px and normal text scaling. Native labels
  describe serving suggestions, eligible menu items, replacement of ordinary
  points on the selected pair, full prices, once per invoice, and points
  rather than cash or wallet credit. Actual item prices remain in the menu.
- Both combo CTAs open the existing Order journey. Café discovery does too.
  Minis lead to existing `/profile/help` phone/WhatsApp contact, not an
  invented catering basket, quote or sent message.
- Existing five member offers and their actions remain on `/campaigns`.
  Turning the combo off keeps a neutral Home link to those other offers.
- The new outlined coin/return icon is in the existing Lucide registry and
  used only for cashback facts (onboarding, How it works, offer slide).
  Generic coins retain their existing meaning.

Precedents: the existing Starbucks/Talabat ordering review informed the
separation of direct ordering from discovery; W3C Images Tutorial explains
why a redundant photo inside an already-labelled action is decorative.
https://www.w3.org/WAI/tutorials/images/decorative/
Existing Expo 56 / Router 56 / React Native 0.85.3 structure takes priority over
skill examples. Impeccable, expo-design-system, expo-native-ui, expo-router,
marketing-psychology and React Best Practices were applied as advisory
reviews. No new animation was needed. No revenue or behavioral uplift is
inferred from the design review.

## Verification

The independent reviewer audited asset contents, copy, eligibility and
route/state boundaries. Deliberate guard mutations for stale points, wrong
menu destination, cramped phone columns, static numeric locale badge and
config-off access all failed as intended and were restored byte-for-byte.

The rendered Chromium matrix covers Arabic/English, 320/390/412px and
light/dark: 40 captures, no page errors or horizontal document overflow.
It shows Home, the embedded cup action, combo entry, campaign and catering.
Runtime journey tests cover actual navigation and basket preservation.
The two bilingual campaign journeys also scan the new page with axe: no
serious or critical violations. This is automated coverage, not a complete
accessibility certification.

| Local check | Result |
|---|---|
| Whole-repository lint and type checking | Passed |
| Unit suites: BFF / app / website | 872 / 513 / 244 passed (1,629 total); existing 3 skips and 1 todo retained |
| Python POS addon client | 40 passed |
| Website production build and final app export | Passed |
| Full exported-app browser suite | 65 passed |
| Campaign suite after adding bilingual axe checks | 6 passed |

The repository's unchanged full GitHub CI gate must pass for the exact PR
head before merge; local results are recorded in the PR.

Evidence uses an exported web app, mock services and a synthetic member.
It does not establish native Android/iPhone behavior, Safari, OS text
scaling, TalkBack/VoiceOver, production POS, scanner or payment operation.
WebKit could not launch on this host due to missing system libraries. The
standard full local E2E server launcher is also blocked by host socket and
network-interface restrictions; the exported-app suite runs separately and
GitHub runs the complete unchanged gate. No messages, payments or production
Odoo writes were made. Completion/time/errors, margin and repeat purchase
remain measurements for a future controlled usability/business test.
