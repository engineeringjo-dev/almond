import type { CartCustomization, ItemSize, MenuItem } from '@/types';
import { LIST_SEPARATOR } from '@/lib/cartLineText';

/**
 * «يُطلب عادةً مع» — THE PAIRINGS IN THE ITEM SHEET.
 *
 * A pairing chip used to call addItem() on every tap and only relabel itself
 * «تمت الإضافة ✓»: two taps put two croissants in the cart, the sheet's CTA
 * still showed the drink alone, and closing the sheet without adding the drink
 * left the croissant behind anyway (audit P1, measured 10.200 → 15.700 JOD).
 *
 * Now a chip only STAGES the pairing — a second tap unstages it — and the
 * sheet's one «أضف للسلة» adds the drink and every staged pairing together, at
 * the total the button showed. Nothing reaches the cart until that tap.
 */

/**
 * What a one-tap add costs: the item's first size with no options, which is
 * exactly the line addItem(item, item.sizes[0], [], 1) creates. Shown on the
 * chip, so the chip and the cart can never quote different prices.
 */
export function quickAddPrice(item: MenuItem): number {
  return item.sizes[0]?.price ?? 0;
}

/** Tap on a pairing chip: stage it, or unstage it if it already was. */
export function togglePairing(staged: readonly string[], id: string): string[] {
  return staged.includes(id) ? staged.filter((x) => x !== id) : [...staged, id];
}

/** What the staged pairings add to the CTA total — each once. */
export function stagedPairingsTotal(staged: readonly MenuItem[]): number {
  return staged.reduce((sum, p) => sum + quickAddPrice(p), 0);
}

/** The sheet's CTA total: the configured item × qty, plus each staged pairing once. */
export function sheetTotal(unit: number, qty: number, staged: readonly MenuItem[]): number {
  return unit * qty + stagedPairingsTotal(staged);
}

/**
 * The line above «أضف للسلة» while pairings are ticked: «يشمل المجموع: كرواسون،
 * مافن (+4.650 د.أ)». The CTA total already counted them; without this line a
 * customer saw the number jump and not why (owner's question, 2026-09-30).
 * `null` when nothing is staged — the line is not drawn at all.
 */
export function stagedPairingsLine(
  staged: readonly MenuItem[],
  lang: 'ar' | 'en',
): { names: string; total: number } | null {
  if (staged.length === 0) return null;
  const names = staged.map((p) => (lang === 'ar' ? p.nameAr : p.nameEn)).join(LIST_SEPARATOR[lang]);
  return { names, total: stagedPairingsTotal(staged) };
}

type AddItem = (item: MenuItem, size: ItemSize, customizations: CartCustomization[], qty: number) => void;

/** One tap, one unit, no choices — the line quickAddPrice() quoted. */
export function quickAdd(addItem: AddItem, item: MenuItem): void {
  const size = item.sizes[0];
  if (size) addItem(item, size, [], 1);
}

/** «أضف للسلة»: the configured item, then each staged pairing, once. */
export function addSheetToCart(
  addItem: AddItem,
  line: { item: MenuItem; size: ItemSize; customizations: CartCustomization[]; qty: number },
  staged: readonly MenuItem[],
): void {
  addItem(line.item, line.size, line.customizations, line.qty);
  for (const p of staged) quickAdd(addItem, p);
}
