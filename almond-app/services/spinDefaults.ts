import type { SpinConfig, SpinPrize } from '@/types';
import { colors } from '@/constants/theme';

/**
 * Default Spin-the-Wheel config (section 2.4). All values are admin-editable
 * at runtime (section 13); these are only the seed defaults.
 * Prizes are weighted; weights need not sum to 100 (normalized for odds).
 */
export const defaultSpinPrizes: SpinPrize[] = [
  { id: 'credit-1', nameAr: 'رصيد 1 دينار', nameEn: '1 JOD credit', type: 'credit', creditValue: 1, weight: 30, enabled: true, expiryDays: 30, color: colors.gold },
  { id: 'cookie', nameAr: 'كوكيز', nameEn: 'Cookie', type: 'free-item', weight: 20, enabled: true, expiryDays: 7, color: colors.brown },
  { id: 'americano', nameAr: 'أمريكانو', nameEn: 'Americano', type: 'free-item', weight: 18, enabled: true, expiryDays: 7, color: colors.dark },
  { id: 'any-drink', nameAr: 'أي مشروب', nameEn: 'Any drink', type: 'free-item', weight: 12, enabled: true, expiryDays: 7, color: colors.lightGold },
  { id: 'omelette-croissant', nameAr: 'كرواسان أومليت', nameEn: 'Omelette croissant', type: 'free-item', weight: 8, enabled: true, expiryDays: 7, color: colors.brown },
  { id: 'pasta', nameAr: 'باستا', nameEn: 'Pasta', type: 'free-item', weight: 5, enabled: true, expiryDays: 7, color: colors.dark },
  { id: 'pizza', nameAr: 'بيتزا', nameEn: 'Pizza', type: 'free-item', weight: 4, enabled: true, expiryDays: 7, color: colors.warmGray },
  { id: 'credit-5', nameAr: 'رصيد 5 دينار', nameEn: '5 JOD credit', type: 'credit', creditValue: 5, weight: 2, enabled: true, expiryDays: 30, color: colors.gold },
  { id: 'cake', nameAr: 'قطعة كيك', nameEn: 'Cake slice', type: 'free-item', weight: 0.8, enabled: true, expiryDays: 7, color: colors.lightGold },
  { id: 'credit-10', nameAr: 'رصيد 10 دينار', nameEn: '10 JOD credit', type: 'credit', creditValue: 10, weight: 0.2, enabled: true, expiryDays: 30, color: colors.gold },
];

export const defaultSpinConfig: SpinConfig = {
  eligibility: {
    enabled: true,
    visitsPerSpin: 5, // section 2.4
    topupAmount: 50,
    freeSpinDays: [], // e.g. [5] for a free spin every Friday (set in admin)
  },
  prizes: defaultSpinPrizes,
  campaigns: [],
};

/** Weighted random selection over enabled prizes (server-side, anti-cheat). */
export function pickWeightedPrize(prizes: SpinPrize[]): { prize: SpinPrize; index: number } {
  const enabled = prizes.filter((p) => p.enabled);
  const total = enabled.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < enabled.length; i++) {
    r -= enabled[i].weight;
    if (r <= 0) return { prize: enabled[i], index: i };
  }
  return { prize: enabled[enabled.length - 1], index: enabled.length - 1 };
}

/** Normalized odds (%) per enabled prize for the admin live-odds preview (section 13.2). */
export function computeOdds(prizes: SpinPrize[]): Record<string, number> {
  const enabled = prizes.filter((p) => p.enabled);
  const total = enabled.reduce((s, p) => s + p.weight, 0) || 1;
  const out: Record<string, number> = {};
  enabled.forEach((p) => {
    out[p.id] = (p.weight / total) * 100;
  });
  return out;
}
