# Profile reward illustration — 2026-10-16

Owner-requested celebratory artwork for a confirmed 50-point profile reward.
The built-in image generator used the existing Almond iced-cup image as a
brand reference. The output was inspected and copied as a whole transparent
512×512 PNG to `assets/rewards/profile-bonus-50.png` (343,628 bytes).

The shipped artwork is decorative on opaque paper, with accessible native
copy stating the actual returned amount and reason. It is shown only after a
fresh successful profile-save reply confirms `bonusAvailablePoints === 50`
and `bonusRecoveredPoints === 0`. The gross `bonusGranted` amount alone does
not trigger it: points recovered after a purchase refund receive an explicit
native notice stating the actual available and recovered amounts. A zero
reply, missing/invalid net fields, a prediction or a seeded balance never
triggers the artwork. Other positive amounts use native text rather than
the fixed-number artwork. Completion
waits for the actual sheet dismissal; repeated delivery of the same response
object does not repeat the presentation. No first-ever purchase or cash
reward is implied.

## Reproduction prompt

Reference image: `assets/campaigns/almond-iced-cup.png`.

```text
Use case: illustration-story.
Asset type: proposed celebratory illustration for Almond Coffee House mobile loyalty app when an actual fifty-point grant is confirmed, not a full app screenshot.
Create one refined square 1024x1024 artwork. The supplied photograph is a BRAND AND CUP SHAPE REFERENCE ONLY. Translate its recognizable transparent iced-coffee cup, dark coffee, ice, and authentic Almond printed white doodles/lettering into an elegant hand-drawn editorial illustration. Preserve the brand identity; do not invent a different logo or turn it into a face/mascot.
Composition: a very large bespoke hand-lettered numeral "50" in warm toasted-almond brown (#975725 family), central and dominant, with tasteful gently imperfect ink contours and flat warm paper shading. Under the numeral write exactly the Arabic word "نقطة", properly joined and with correct dots, bold black and very legible. These are the ONLY headline words/numbers: "50" and "نقطة". A small illustrated Almond iced-coffee cup overlaps the lower right edge of the numeral without hiding its reading. A few lively, carefully placed black and toasted-almond ink confetti strokes, tiny circles, and one small croissant-line motif make the moment celebratory. Handmade cafe identity, mature, warm, joyful, highly art-directed, not a generic rewards badge.
Background fully transparent with a clean alpha channel; the flat artwork must work when placed on the app's white/paper surface. Keep generous clear margins. Crisp dark ink and warm brown; sparse restrained color. No gradient, no glossy 3D, no gold coins, no dollar/currency symbols, no percentage, no cashback wording, no price, no QR/barcode, no buttons, no frame, no watermark, no heavy shadows. All lettering sharp enough for mobile. This is a points illustration, not cash or a discount.
```
