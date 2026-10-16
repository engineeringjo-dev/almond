---
name: Almond — Daylight Counter
description: Ink, paper and owned product photography, with warmth reserved for reward value.
colors:
  ink-light: "#111111"
  ink-dark: "#F2F2F0"
  paper-light: "#FFFFFF"
  paper-dark: "#0F0F0F"
  card-dark: "#1A1A19"
  control-light: "#F4F4F2"
  control-dark: "#242423"
  outline-light: "#8A8A85"
  outline-dark: "#75756F"
  muted-light: "#5C5C58"
  muted-dark: "#A3A39E"
  quiet-light: "#EFEFEC"
  quiet-dark: "#2A2A28"
  selected-light: "#E6E6E2"
  selected-dark: "#33332F"
  hero-edge-dark: "#3A3A37"
  hero-muted-light: "#BDBDB8"
  reward-light: "#975725"
  reward-dark: "#E0AD70"
  success-light: "#1E7B4A"
  success-dark: "#6FCF97"
  error-light: "#B3261E"
  error-dark: "#F2B8B5"
typography:
  display: { fontFamily: HelveticaNeueArabic-Bold, fontSize: 36px, lineHeight: 44px }
  headline: { fontFamily: HelveticaNeueArabic-Bold, fontSize: 28px, lineHeight: 38px }
  title: { fontFamily: HelveticaNeueArabic-Bold, fontSize: 22px, lineHeight: 30px }
  title-small: { fontFamily: HelveticaNeueArabic-Bold, fontSize: 18px, lineHeight: 26px }
  body: { fontFamily: HelveticaNeueArabic-Roman, fontSize: 16px, lineHeight: 24px }
  label: { fontFamily: HelveticaNeueArabic-Bold, fontSize: 16px, lineHeight: 24px }
  caption: { fontFamily: HelveticaNeueArabic-Roman, fontSize: 14px, lineHeight: 20px }
  price: { fontFamily: HelveticaNeueArabic-Bold, fontSize: 16px, lineHeight: 22px }
  nav-label: { fontFamily: HelveticaNeueArabic-Bold, fontSize: 11px, lineHeight: 16px }
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
components:
  button-primary: { backgroundColor: "{colors.ink-light}", textColor: "{colors.paper-light}", typography: "{typography.label}", rounded: "{rounded.md}", padding: "12px 24px" }
  button-secondary: { backgroundColor: "{colors.paper-light}", textColor: "{colors.ink-light}", typography: "{typography.label}", rounded: "{rounded.md}", padding: "12px 24px" }
  button-outline: { backgroundColor: transparent, textColor: "{colors.ink-light}", typography: "{typography.label}", rounded: "{rounded.md}", padding: "12px 24px" }
  button-ghost: { backgroundColor: transparent, textColor: "{colors.ink-light}", typography: "{typography.label}", rounded: "{rounded.md}", padding: "12px 24px" }
  search: { backgroundColor: "{colors.control-light}", textColor: "{colors.ink-light}", typography: "{typography.body}", rounded: "{rounded.pill}", height: 48px }
  category-chip: { backgroundColor: "{colors.paper-light}", textColor: "{colors.ink-light}", typography: "{typography.caption}", rounded: "{rounded.pill}", padding: "8px 12px" }
  navigation: { textColor: "{colors.ink-light}", typography: "{typography.nav-label}" }
  card: { backgroundColor: "{colors.paper-light}", rounded: "{rounded.lg}", padding: 16px }
  membership-card: { backgroundColor: "{colors.ink-light}", textColor: "{colors.paper-light}", rounded: "{rounded.xl}", padding: "12px 16px" }
  redemption-chip-selected: { backgroundColor: "{colors.reward-light}", textColor: "{colors.paper-light}", rounded: "{rounded.md}" }
---

# Design System: Almond — Daylight Counter

## Overview

**Creative North Star: "Daylight Counter"**

Almond feels like a clear café counter: paper, ink, the real Almond badge and recognizable products. The existing Helvetica Neue Arabic family carries both languages. White photograph grounds are part of the owned imagery; the interface gives the product room rather than adding decorative artwork.

The owner selected this world on 2026-10-16. This record captures the accepted Home, Rewards, Order, Item sheet and Pay implementation. Component tokens above describe the light appearance; the role mapping below supplies dark appearance. Code remains the source of truth: [shared theme](../packages/shared/src/theme/index.ts), [app theme entrypoint](constants/theme.ts), [approved brief](docs/daylight-counter-brief.md). Review evidence and limits are in [validation](docs/daylight-counter-validation.md).

**Key Characteristics:**

- Neutral ordering and navigation, with one warm reward hue.
- Product photographs lead; clear bilingual type explains the action.
- Compact groups, separated tasks and touch targets that survive narrow widths.

## Colors

### Primary

Ink carries primary text, prices, selected ordering controls and navigation. Toasted almond is the single chromatic brand accent, with a lighter counterpart on dark grounds. Frontmatter names identify extracted values; application aliases remain unchanged.

| Application role | Light token | Dark token |
|---|---|---|
| `dark`, `primary`, legacy `gold` | `ink-light` | `ink-dark` |
| `onInk`, `onReward` | `paper-light` | `paper-dark` |
| `reward` | `reward-light` | `reward-dark` |
| `hero` | `ink-light` | `card-dark` |
| `heroEdge` | `ink-light` | `hero-edge-dark` |
| `onHero` | `paper-light` | `ink-dark` |
| `onHeroMuted` | `hero-muted-light` | `muted-dark` |
| `onHeroReward` | `reward-dark` | `reward-dark` |

**The Reward Scope Rule.** Warmth marks points worth, cashback/earn-rate context and redemption emphasis. Ordering controls, prices and navigation stay ink.

### Neutral

| Application role | Light token | Dark token |
|---|---|---|
| `cream` — page | `paper-light` | `paper-dark` |
| `cardBg` — raised surface | `paper-light` | `card-dark` |
| `surface` — resting field/quiet action fill | `control-light` | `control-dark` |
| `outline` — findable control edge | `outline-light` | `outline-dark` |
| `warmGray`, `brown` — secondary copy | `muted-light` | `muted-dark` |
| `neutralWarm` — quiet fill/divider | `quiet-light` | `quiet-dark` |
| `lightGold` — neutral selected/supporting fill | `selected-light` | `selected-dark` |

Success and error retain the extracted semantic green/red pairs; they are feedback, not extra brand accents. Literal `white` stays white for QR grounds and existing product-photo grounds. `photoDim` adds the existing dark-photo overlay (`rgba(15,15,15,0.12)`); it never dims the QR.

**The Surface Pair Rule.** Use `onInk` on ink fills, `onHero`/`onHeroMuted` on hero cards and `onReward` on reward fills. Never substitute literal white for a scheme-aware foreground. Appearance is selected at launch from the system setting, through the app theme entrypoint.

## Typography

The bundled Helvetica Neue LT Arabic is the display and body family. Roman handles reading; Bold handles hierarchy and action. `medium`, `serif` and `inter` are legacy aliases to these faces, not additional type families. Sources: [font loader](constants/fonts.ts), [Text](components/ui/Text.tsx), [tab labels](app/(tabs)/_layout.tsx).

Frontmatter roles map to `Text` variants as follows: `headline` → `h1`, `title` → `h2`, `title-small` → `title`, `label` → `bodyBold`; other names match directly. Font size and line height are React Native logical units, expressed as pixels for portable web documentation. Component-local compact captions and balances keep their measured overrides; they do not create a new scale.

**The Bilingual Line Rule.** Keep the implemented line heights, natural wrapping and Latin digits. Text chooses its own writing direction while alignment follows the interface reading start. Preserve tabular numerals on balances and amount choices. Do not compress Arabic ascenders to fit a fixed line.

## Layout

[Screen](components/ui/Screen.tsx) centers a full-width journey column capped at (680px), with the shared `lg` outer inset and (64px) bottom content padding. Order uses the same width and inset; its menu reserves (128px) below the list for the pickup/cart bar. [BottomSheet](components/ui/BottomSheet.tsx) centers at a (640px) maximum width and (90% of window height), keeping its footer outside scrolling content. The bottom navigation reserves the safe-area inset, with a (16px) minimum bottom pad.

Use the shared spacing scale: `xs`/`sm` within a group, `lg`/`xl` between tasks. Order uses two columns with a `md` gap. [MenuItemCard](components/menu/MenuItemCard.tsx) puts copy directly on the page below the photo; its two-line name block and row measurement preserve category jumps. [menuList](lib/menuList.ts) caps photo height at (192px), fitting the available column below that. Bundled photo framing trims white margin using measured bounds on a (512px) canvas with (24px) safety padding; unknown photos use full contain. Refresh that metadata when its source images change.

Below (360px), Rewards amount choices reflow to two per row and the Item footer stacks quantity above Add. Item also stacks above a font scale of (1.2). Order's English sub-tabs use two rows below (360px); either language uses two rows above that font scale. These are local adaptations, not a new global breakpoint grid. Sources: [Order](app/(tabs)/order.tsx), [Rewards](app/(tabs)/rewards.tsx), [ItemModal](components/menu/ItemModal.tsx).

Touch targets are sized to at least (44pt) on iOS/web and (48dp) on Android by [the shared app helper](lib/a11y.ts); the primary Button has a (52-unit) minimum height. Long labels wrap rather than shrinking away. Native target values are implementation facts, not evidence of device testing.

## Elevation & Depth

Most separation comes from paper, quiet fills, edges and space. Shared cards use a soft offset shadow; the raised barcode action uses the stronger shadow. Dark appearance halves shadow opacity and relies on a lighter card ground. Hero cards use their own edge rather than inheriting a decorative glow.

| Shared shadow | Offset | Radius | Light / dark opacity | Android elevation |
|---|---|---|---|---|
| `card` | (0, 2) | 8 | 0.08 / 0.04 | 2 |
| `raised` | (0, 6) | 16 | 0.14 / 0.07 | 6 |

These are native shadow parameters from `shadowsFor`, not a promise that every renderer produces identical CSS blur. The modal scrim is `rgba(17,17,17,0.45)` in light appearance and `rgba(0,0,0,0.6)` in dark appearance.

## Shapes

Continuous corners soften controls without making every surface a floating card. Use `md` for main buttons and amount/size choices, `lg` for shared cards and offer tiles, `xl` for membership cards and sheet top corners, and `pill` for category chips and search. Menu photo planes stay square-edged; product photography supplies the form. The real logo remains an identity asset, not a new corner or icon generator.

## Components

- **Buttons** — [Button](components/ui/Button.tsx) uses a filled ink primary, card-ground secondary with an ink edge (1.5 units), transparent outline with the same edge, and transparent ghost. Padding and shape are in frontmatter. Pressed opacity is (0.85); disabled/loading opacity is (0.45). Loading replaces the label with its foreground-colored spinner and blocks activation.
- **Search** — [SearchBar](components/ui/SearchBar.tsx) is a pill with a control fill, outline edge (1 unit), muted placeholder and a sized clear action. Its height is fixed at the frontmatter value. Reading-start alignment follows the interface language.
- **Chips and choices** — [CategoryChips](components/menu/CategoryChips.tsx) rest on the page with an outline; current categories fill with ink and use `onInk`. Categories navigate within the list and expose `aria-current`. Item sizes are radio choices; add-ons use radio/checkbox marks. Rewards uses a reward edge for whole-balance emphasis and reward fill/`onReward` for the amount whose confirmation is open.
- **Cards and photography** — [HeroCard](components/ui/HeroCard.tsx) supplies only ground and edge; callers supply radius and padding. [LoyaltyCard](components/home/LoyaltyCard.tsx) combines points, warm worth, wallet and a full-size code action. [PhotoTile](components/home/PhotoTile.tsx) has an ink order variant and a quiet offer variant whose photo occupies the end (42%). Keep owned product images and the existing [PhotoDim](components/ui/PhotoDim.tsx). Shared [Card](components/ui/Card.tsx) adds its quiet edge and card shadow.
- **Navigation** — Five fixed bottom destinations use neutral line icons and labels. Active icons strengthen their stroke and add a dot; the central barcode action is raised. Order sub-tabs use an ink underline and the narrow-layout behavior above. Sources: [tab layout](app/(tabs)/_layout.tsx), [TabBarIcon](components/ui/TabBarIcon.tsx), [barcode action](components/ui/TabBarBarcodeButton.tsx).
- **Item and Pay** — The item sheet retains every modifier, a visible close action and a pinned quantity/Add footer. Pay gives the real server-issued code a black-on-white ground, followed by its account fallback and reward context; code loading, expiry and retry stay explicit. Sources: [ItemModal](components/menu/ItemModal.tsx), [EarnQr](components/pay/EarnQr.tsx), [Pay](app/(tabs)/pay.tsx).

This direction adds no motion. Existing sheet and QR feedback remain and respect reduced motion. Browser hover/focus CSS in `.impeccable/design.json` is a panel preview affordance; it does not establish additional application states or replace React Native behavior.

### Owner additions, 2026-10-16

The owner requested one illustrated profile-reward moment and a manually
swiped Home offer collection. The fixed 50-point Almond-cup illustration is
shown only for a fresh server-confirmed net 50-point profile reward with no
refund recovery; native text carries the amount and reason. This is a narrow
exception to the decorative-artwork rule, with no added animation. See
[the artwork and prompt](docs/profile-bonus-illustration.md).

Home keeps membership, ordering and the usual order first. The campaign
collection uses owned product and gift-card photography, manual swipe and
visible previous/next controls, without automatic rotation. Price and
ordering controls remain neutral. The owner's requested red Cash back label
is confined to the combo photograph and retains the configured point amount
and eligible-purchase terms.

The app-opening motion remains a proposal. Its revised brief requires no
artificial wait before membership or ordering; it does not authorize a video
download or motion sequence to block launch. See
[the revised opening proposal](../docs/design/OPENING-REVISION-2026-10.ar.md).

## Do's and Don'ts

### Do:

- **Do** reuse the shared palette through `constants/theme.ts`, with the correct foreground/surface pair.
- **Do** keep ordering and navigation neutral while making real reward value warm.
- **Do** preserve the real logo, bundled bilingual fonts and existing product photographs.
- **Do** preserve readable wrapping, full touch targets, modifier choices and the server-issued scan code.

### Don't:

- **Don't** treat the legacy `gold`/`lightGold` names as permission to color prices or ordering controls gold.
- **Don't** add decorative artwork, extra brand hues or new entrance motion to this approved direction.
- **Don't** replace shared pricing, points or redemption rules with presentation-layer calculations.
- **Don't** treat sidecar preview snippets or synthesized tonal ramps as new app components or palette tokens.

Not canonized: stale implementation comments referring to gold prices, lavender borders or an exclusively black membership block; browser defaults that have no shared app token; unverified native/Safari behavior. The accepted code and role mapping above govern the system.
