import type { GiftOccasion } from '@/types';
import type { IconName } from '@/components/ui/Icon';
import type { gradients } from '@/constants/theme';

export type GiftGradient = keyof typeof gradients;

/**
 * eGift card designs — Almond theme + logo (no third-party artwork). Each is a
 * landscape card: a brand gradient + a short greeting + an occasion icon, with
 * the Almond badge in the corner (matches the reference card shapes).
 */
export interface GiftDesign {
  id: string;
  occasion: GiftOccasion;
  greetingAr: string;
  greetingEn: string;
  gradient: GiftGradient;
  icon: IconName;
  /** Text/badge tone over the gradient. */
  tone: 'light' | 'dark';
}

export const GIFT_DESIGNS: GiftDesign[] = [
  // Anytime
  { id: 'anytime-almond', occasion: 'anytime', greetingAr: 'قهوة على ذوقك', greetingEn: 'Coffee, your way', gradient: 'purple', icon: 'coffee', tone: 'light' },
  { id: 'anytime-treat', occasion: 'anytime', greetingAr: 'القهوة عليّ', greetingEn: "It's my treat", gradient: 'gold', icon: 'coffee', tone: 'light' },
  // Birthday
  { id: 'birthday-cake', occasion: 'birthday', greetingAr: 'كل عام وأنت بخير 🎂', greetingEn: 'Happy Birthday', gradient: 'rainbow', icon: 'gift', tone: 'dark' },
  { id: 'birthday-celebrate', occasion: 'birthday', greetingAr: 'نحتفل فيك اليوم', greetingEn: "Let's celebrate you", gradient: 'purple', icon: 'sparkles', tone: 'light' },
  // Thank you
  { id: 'thankyou-heart', occasion: 'thankyou', greetingAr: 'شكراً لك ❤️', greetingEn: 'Thank you', gradient: 'mocha', icon: 'heart', tone: 'light' },
  { id: 'thankyou-star', occasion: 'thankyou', greetingAr: 'أنت رائع', greetingEn: "You're a star", gradient: 'gold', icon: 'bean', tone: 'light' },
  // Congrats
  { id: 'congrats-yay', occasion: 'congrats', greetingAr: 'مبروك! 🎉', greetingEn: 'Congrats!', gradient: 'rainbow', icon: 'sparkles', tone: 'dark' },
  { id: 'congrats-proud', occasion: 'congrats', greetingAr: 'فخورون فيك', greetingEn: "You did it", gradient: 'purple', icon: 'gift', tone: 'light' },
  // Celebration
  { id: 'celebration-cheers', occasion: 'celebration', greetingAr: 'بصحتك ☕', greetingEn: 'Cheers to you', gradient: 'mocha', icon: 'coffee', tone: 'light' },
  // Love you
  { id: 'loveyou-care', occasion: 'loveyou', greetingAr: 'يومك أحلى بقهوة', greetingEn: 'A better day with coffee', gradient: 'gold', icon: 'heart', tone: 'light' },
  // Eid
  { id: 'eid-mubarak', occasion: 'eid', greetingAr: 'عيد مبارك ✨', greetingEn: 'Eid Mubarak', gradient: 'purple', icon: 'sparkles', tone: 'light' },
  { id: 'eid-joy', occasion: 'eid', greetingAr: 'كل عيد وأنت بخير', greetingEn: 'Happy Eid', gradient: 'rainbow', icon: 'gift', tone: 'dark' },
  // Ramadan
  { id: 'ramadan-kareem', occasion: 'ramadan', greetingAr: 'رمضان كريم 🌙', greetingEn: 'Ramadan Kareem', gradient: 'mocha', icon: 'sparkles', tone: 'light' },
  // Graduation
  { id: 'grad-congrats', occasion: 'graduation', greetingAr: 'مبروك التخرّج 🎓', greetingEn: 'Congrats, grad!', gradient: 'purple', icon: 'sparkles', tone: 'light' },
  // Wedding
  { id: 'wedding-love', occasion: 'wedding', greetingAr: 'مبروك الزواج 💍', greetingEn: 'Just married', gradient: 'gold', icon: 'heart', tone: 'light' },
  // New baby
  { id: 'baby-welcome', occasion: 'newbaby', greetingAr: 'مبروك المولود 🍼', greetingEn: 'Welcome, little one', gradient: 'rainbow', icon: 'heart', tone: 'dark' },
  // Get well
  { id: 'getwell-soon', occasion: 'getwell', greetingAr: 'سلامتك ❤️', greetingEn: 'Get well soon', gradient: 'mocha', icon: 'heart', tone: 'light' },
];

/** Occasions in display order, with their section titles. */
export const GIFT_OCCASIONS: { id: GiftOccasion; titleAr: string; titleEn: string }[] = [
  { id: 'anytime', titleAr: 'في أي وقت', titleEn: 'Anytime' },
  { id: 'birthday', titleAr: 'عيد ميلاد', titleEn: 'Birthday' },
  { id: 'eid', titleAr: 'العيد', titleEn: 'Eid' },
  { id: 'ramadan', titleAr: 'رمضان', titleEn: 'Ramadan' },
  { id: 'thankyou', titleAr: 'شكراً', titleEn: 'Thank you' },
  { id: 'congrats', titleAr: 'مبروك', titleEn: 'Congrats' },
  { id: 'graduation', titleAr: 'تخرّج', titleEn: 'Graduation' },
  { id: 'wedding', titleAr: 'زواج', titleEn: 'Wedding' },
  { id: 'newbaby', titleAr: 'مولود جديد', titleEn: 'New baby' },
  { id: 'getwell', titleAr: 'سلامتك', titleEn: 'Get well' },
  { id: 'celebration', titleAr: 'احتفال', titleEn: 'Celebration' },
  { id: 'loveyou', titleAr: 'لمن تحب', titleEn: 'For someone you love' },
];

export function giftDesignById(id: string): GiftDesign {
  return GIFT_DESIGNS.find((d) => d.id === id) ?? GIFT_DESIGNS[0];
}

export function giftDesignsByOccasion(occasion: GiftOccasion): GiftDesign[] {
  return GIFT_DESIGNS.filter((d) => d.occasion === occasion);
}
