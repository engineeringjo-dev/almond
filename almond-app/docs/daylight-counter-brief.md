# Direction A — Daylight Counter

Approved by the owner with “a” on 2026-10-16, after the five-role audit and the
three-direction comparison. This is the implementation brief, not a change
to the shared loyalty or pricing contract.

- **THESIS:** Make everyday ordering feel clear and quick; give Almond's
  own product photographs more room and reserve warmth for rewards.
- **OWN-WORLD:** White paper and near-black ink, the existing Almond badge
  and Helvetica Neue Arabic. One toasted-almond reward hue, with a lighter
  counterpart on dark surfaces. Photos are genuine existing menu assets.
- **STORY:** Membership first at the till; then ordering, offers and usual
  order. Menu photos lead discovery, the item sheet keeps every modifier,
  Rewards explains actual value, and Pay prioritizes the real scannable code.
- **FIRST VIEWPORT:** Compact black membership card, visible code action,
  ink ordering strip with a real product photo, followed by larger offer
  imagery. Actual balances and content replace the concept's sample values.
- **FORM:** User-pinned direction A; no new concept selection is needed.
  Five existing routes/states: Home, Rewards, Order, Item sheet and Pay.
  Neutral ordering/navigation controls; warm points worth, cashback and
  selected redemption. No added entrance motion or decorative imagery.

The approved comparison is `Almond_Visual_Directions_2026-10-16.html` and its
five-screen PDF, delivered to the owner before implementation. They are
reference artifacts, not application code or additional menu content.

Responsive adaptations preserve complete text and touch targets: menu photos
scale in two columns; amount choices reflow at narrow widths; item quantity
and Add stack below 360px or with enlarged system text. Journey content uses
the existing 680px maximum width. Dark mode keeps the same roles and dims
white photograph grounds through the existing PhotoDim component.

Review against the approved A reference, WCAG AA contrast, Arabic/English,
320/390/412px and the observed 1363px browser width. Chromium touch emulation
does not substitute for native iPhone/Android, Safari, a physical QR scan,
the production POS or payment validation.
