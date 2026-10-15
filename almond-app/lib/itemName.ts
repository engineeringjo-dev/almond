import type { Lang } from '@/types';

/**
 * The item's name in the OTHER language, for the grey second line under the
 * name on a menu tile and in the item sheet — or null when there is nothing
 * to add.
 *
 * NONE IN ARABIC. Arabic is the app's first language, and an Arabic menu is
 * read in Arabic: «لاتيه مثلج» over «Iced Latte» on every tile was a second
 * menu printed in grey, and it took the line a long name needs (expert panel,
 * 2026-10-15). Precedent: Talabat and Careem print one language. An English
 * reader still gets the Arabic name, which is what the counter's board says.
 *
 * Odoo leaves many products untranslated, so both names hold the same text and
 * the tile read «Cortado / Cortado», «Iced Cappuccino … / Iced Cappuccino Col…»
 * (audit P2). Compared case-, space- and punctuation-insensitively, so a stray
 * capital or double space does not bring the duplicate back.
 */
export function secondaryName(names: { nameAr: string; nameEn: string }, lang: Lang): string | null {
  if (lang === 'ar') return null;
  const primary = names.nameEn;
  const other = names.nameAr;
  const key = (s: string) => (s ?? '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}]+/gu, '');
  if (!key(other) || key(other) === key(primary)) return null;
  return other.trim();
}
