import type { Lang } from '@/types';

/**
 * The item's name in the OTHER language, for the grey second line under the
 * name on a menu tile and in the item sheet — or null when there is nothing
 * to add.
 *
 * Odoo leaves many products untranslated, so both names hold the same text and
 * the tile read «Cortado / Cortado», «Iced Cappuccino … / Iced Cappuccino Col…»
 * (audit P2). Compared case-, space- and punctuation-insensitively, so a stray
 * capital or double space does not bring the duplicate back.
 */
export function secondaryName(names: { nameAr: string; nameEn: string }, lang: Lang): string | null {
  const primary = lang === 'ar' ? names.nameAr : names.nameEn;
  const other = lang === 'ar' ? names.nameEn : names.nameAr;
  const key = (s: string) => (s ?? '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}]+/gu, '');
  if (!key(other) || key(other) === key(primary)) return null;
  return other.trim();
}
