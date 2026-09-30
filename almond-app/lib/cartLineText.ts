import type { CartItem, Lang } from '@/types';

/** Between items of a list: the Arabic comma in Arabic, a comma in English. */
export const LIST_SEPARATOR: Record<Lang, string> = { ar: '، ', en: ', ' };

/**
 * The one line under a cart item that says what was chosen: the size, then
 * every customization — «وسط · حليب شوفان، شوت إضافي» / "Medium · Oat milk,
 * Extra shot". The cart and the review both render it IN FULL (wrapped):
 * this is where a customer checks which milk they asked for, and both used to
 * cut it to one line («صغير · د…» at 320 px, audit P2).
 *
 * The list separator follows the language — the Arabic comma «،» in Arabic,
 * ", " in English (English lines used to be joined with «،»).
 */
export function customizationText(
  line: Pick<CartItem, 'sizeNameAr' | 'sizeNameEn' | 'customizations'>,
  lang: Lang,
): string {
  const size = lang === 'ar' ? line.sizeNameAr : line.sizeNameEn;
  const options = line.customizations
    .map((c) => (lang === 'ar' ? c.nameAr : c.nameEn))
    .filter((name) => name.trim().length > 0)
    .join(LIST_SEPARATOR[lang]);
  return [size, options].filter((part) => part.length > 0).join(' · ');
}
