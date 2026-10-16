# Home campaign peeks — 2026-10-16

The owner requested visible neighbouring imagery and a random opening card
on each visit. Home still keeps membership, ordering and the usual order ahead
of discovery. Campaign order, truthful wallet qualifications, real artwork,
destinations and basket behaviour are unchanged.

The manual track centres a card with an 8px gap and 20px of a real neighbour
on either side, including at both logical ends. Two visual-only end copies
make those peeks continuous. They have no actions and are hidden from assistive
technology. Settling on an end copy immediately rebases to its identical
original; only the active original has a focusable action. Previous/Next wrap,
remain 44pt targets and keep focus on the control. Arabic finger-right advances;
English finger-left advances. Native scrolling handles the gesture; web uses
CSS centre snapping and the existing event-driven idle settlement. Buttons
move instantly, preserving the latest rapid-button destination.

Expo Router focus chooses an opening card once per Home entry, including a tab
return. All eligible cards have the same chance; their order stays fixed.
StrictMode effect replay, rendering, resizing and manual navigation do not
choose again within that visit. There is no autoplay, periodic randomisation,
new dependency, hidden testing setting or custom gesture responder.

Precedents: WAI-ARIA's basic carousel pattern for explicit controls and active
content, and React Native 0.85 ScrollView interval snapping for direct manual
scrolling. Existing Expo 56 / RN 0.85 takes priority over advisory design skill
examples. The neighbouring images make the horizontal interaction visible.

- https://www.w3.org/WAI/ARIA/apg/patterns/carousel/
- https://reactnative.dev/docs/0.85/scrollview

Focused verification: 46 campaign/Home unit tests pass on Node 22, including
all seven random choices, focus entry/replay/return, 288–648px track geometry,
both directional wraps, canonical copy rebasing and rapid intents across a
wrap. App and E2E TypeScript checking and scoped ESLint pass. Browser tests
now navigate from the actual random start and cover real bilingual touch,
resize, active-only actions, 320px light/dark bilateral photo peeks, circular
touch wrap, rapid Next and bounded test-only RNG on tab return.

The root reviewer owns final export, runtime execution, full repository gates
and publication. Those new browser expectations have not yet been executed
for this source. Native device, VoiceOver/TalkBack and Safari verification
remain outside the local Chromium evidence. No guard mutations were performed
during the root reviewer's active test window.
