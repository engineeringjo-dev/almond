import type { GiftOccasion } from '../types';

/**
 * eGIFT CARD DESIGNS — the Almond "Vector Cards R1" set (GM, 2026-09-30:
 * «نستخدمهم لل gift card برنامج الولاء والموقع»). One list for the app and
 * the website; each renders the same artwork file named by `id`:
 *
 *   app  → almond-app/assets/gift-cards/<id>.webp   (lib/giftArt.ts)
 *   web  → almond-web/public/gift-cards/<id>.webp
 *
 * Rules from the design brief, kept on purpose:
 *   - The phrase IS the card. It is part of the artwork and is never drawn
 *     over, restyled or translated on the face.
 *   - Personal details (amount, recipient, message) go OUTSIDE the face —
 *     "inside the envelope" — never on top of the art.
 *   - The Almond logo stays exactly as drawn in the artwork.
 *
 * `id` is stored on every GiftCard (`designId`), so an id is permanent: add
 * new designs with new ids, never rename or reuse one.
 */

export type GiftDesignLang = 'ar' | 'en';

export interface GiftDesign {
  /** Permanent id, stored on GiftCard.designId. Also the artwork file name. */
  id: string;
  /** The print code in the source PDF (AR01…EN06). */
  code: string;
  /** Language of the phrase printed on the card. */
  lang: GiftDesignLang;
  occasion: GiftOccasion;
  /** The phrase exactly as printed (in `lang`) — the screen-reader label. */
  phrase: string;
  /** The phrase's meaning in the other language, for a caption or hint. */
  gloss: string;
  /** Background of the art: the placeholder colour while the image loads. */
  bg: string;
  /** Main ink colour of the art. */
  ink: string;
}

export const GIFT_DESIGNS: readonly GiftDesign[] = [
  { id: 'ar01', code: 'AR01', lang: 'ar', occasion: 'anytime', phrase: 'إنت عالبال.', gloss: "You're on my mind.", bg: '#E6CAC6', ink: '#63313E' },
  { id: 'ar02', code: 'AR02', lang: 'ar', occasion: 'thankyou', phrase: 'شكراً... والقهوة عليّ.', gloss: "Thank you — coffee's on me.", bg: '#BAC8B1', ink: '#254036' },
  { id: 'ar03', code: 'AR03', lang: 'ar', occasion: 'birthday', phrase: 'كل سنة وإنت بخير.', gloss: 'Many happy returns.', bg: '#F1DA8C', ink: '#3D5A92' },
  { id: 'ar04', code: 'AR04', lang: 'ar', occasion: 'graduation', phrase: 'مبروك... وتستاهل.', gloss: 'Congratulations — you deserve it.', bg: '#183F55', ink: '#F4E9D6' },
  { id: 'ar05', code: 'AR05', lang: 'ar', occasion: 'selfcare', phrase: 'استراحة بتستاهلها.', gloss: 'A break you deserve.', bg: '#B96850', ink: '#F1DFC5' },
  { id: 'en01', code: 'EN01', lang: 'en', occasion: 'anytime', phrase: "Because you're precious.", gloss: 'لأنك غالي.', bg: '#22211F', ink: '#F3EADF' },
  { id: 'en02', code: 'EN02', lang: 'en', occasion: 'thankyou', phrase: 'A little gift. A big thank you.', gloss: 'هدية صغيرة. وشكر كبير.', bg: '#BED4E2', ink: '#3A2B28' },
  { id: 'en03', code: 'EN03', lang: 'en', occasion: 'birthday', phrase: 'A little birthday happiness.', gloss: 'شوية فرح لعيد ميلادك.', bg: '#C7B8DF', ink: '#3D304D' },
  { id: 'en04', code: 'EN04', lang: 'en', occasion: 'anytime', phrase: 'Just because.', gloss: 'بدون مناسبة.', bg: '#DB927F', ink: '#542F47' },
  { id: 'en05', code: 'EN05', lang: 'en', occasion: 'graduation', phrase: "Here's to your next chapter.", gloss: 'لفصلك الجاي.', bg: '#224C54', ink: '#F7EEE0' },
  { id: 'en06', code: 'EN06', lang: 'en', occasion: 'selfcare', phrase: 'Your next little escape.', gloss: 'استراحتك الصغيرة الجاية.', bg: '#6A704E', ink: '#F3EBDA' },
];

/** The core premium edition — the hero card and the fallback design. */
export const FEATURED_GIFT_DESIGN_ID = 'en01';

/** Occasions that have designs, in display order. */
export const GIFT_OCCASIONS: readonly { id: GiftOccasion; titleAr: string; titleEn: string }[] = [
  { id: 'anytime', titleAr: 'في أي وقت', titleEn: 'Anytime' },
  { id: 'birthday', titleAr: 'عيد ميلاد', titleEn: 'Birthday' },
  { id: 'thankyou', titleAr: 'شكراً', titleEn: 'Thank you' },
  { id: 'graduation', titleAr: 'نجاح وتخرّج', titleEn: 'Success & graduation' },
  { id: 'selfcare', titleAr: 'استراحة', titleEn: 'Time out' },
];

const byId = new Map(GIFT_DESIGNS.map((d) => [d.id, d]));

/** An occasion's designs, the ones in the reader's language first. */
export function giftDesignsFor(occasion: GiftOccasion, uiLang: GiftDesignLang): GiftDesign[] {
  const list = GIFT_DESIGNS.filter((d) => d.occasion === occasion);
  return [...list.filter((d) => d.lang === uiLang), ...list.filter((d) => d.lang !== uiLang)];
}

/**
 * The design for a stored designId. Gifts sent before this set carry older
 * ids — the app's generated designs ('birthday-cake', 'anytime-treat') and
 * the website's bare occasion ('birthday'). They keep their occasion's
 * first Arabic design; anything else falls back to the featured card, so an
 * old gift always renders a real card and never a blank.
 */
export function giftDesignById(id: string | undefined | null): GiftDesign {
  if (id) {
    const exact = byId.get(id);
    if (exact) return exact;
    const occ = GIFT_OCCASIONS.find((o) => id === o.id || id.startsWith(`${o.id}-`));
    if (occ) return giftDesignsFor(occ.id, 'ar')[0];
  }
  return byId.get(FEATURED_GIFT_DESIGN_ID)!;
}
