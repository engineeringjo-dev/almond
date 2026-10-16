import { cartLineFor, lineUnitPrice } from '@almond/shared/cart';
import type { CartCustomization, CartItem, ItemSize, MenuItem } from '@/types';

/** An edit is a draft until Save. Keep even choices no longer in the menu so
 * the customer, rather than a filter, decides what to remove or replace. */
export interface CartEditDraft {
  sizeId: ItemSize['id'];
  customizations: CartCustomization[];
  qty: number;
}

export type CartEditIssue =
  | 'itemUnavailable'
  | 'sizeUnavailable'
  | 'optionsUnavailable'
  | 'optionsChanged'
  | 'quantityInvalid'
  | 'unpriced'
  | 'lineChanged'
  | 'menuChanged'
  | 'mergeChanged';

export function draftForCartLine(line: CartItem): CartEditDraft {
  return {
    sizeId: line.sizeId,
    customizations: line.customizations.map((c) => ({ ...c })),
    qty: line.qty,
  };
}

export function resolveCartEdit(item: MenuItem | null | undefined, draft: CartEditDraft): {
  line: CartItem | null;
  issue: CartEditIssue | null;
  unavailable: CartCustomization[];
} {
  const unavailable: CartCustomization[] = [];
  const current: CartCustomization[] = [];
  for (const selected of draft.customizations) {
    const group = item?.customizations.find((g) => g.id === selected.groupId);
    const option = group?.options.find((o) => o.id === selected.optionId);
    if (!option) unavailable.push(selected);
    else current.push({
      groupId: selected.groupId,
      optionId: option.id,
      nameAr: option.nameAr,
      nameEn: option.nameEn,
      priceDelta: option.priceDelta,
    });
  }
  const fail = (issue: CartEditIssue) => ({ line: null, issue, unavailable });
  if (!item || item.inStock === false) return fail('itemUnavailable');
  const size = item.sizes.find((s) => s.id === draft.sizeId);
  if (!size) return fail('sizeUnavailable');
  if (unavailable.length) return fail('optionsUnavailable');
  // A menu may change a checkbox group into a radio group. Preserve all of
  // its saved choices until the customer explicitly selects a replacement.
  if (item.customizations.some((g) => !g.multiple && current.filter((c) => c.groupId === g.id).length > 1)) {
    return fail('optionsChanged');
  }
  if (!Number.isSafeInteger(draft.qty) || draft.qty < 1) return fail('quantityInvalid');
  const line = cartLineFor(item, size, current, draft.qty);
  // The server also refuses a configuration without a positive price.
  if (!Number.isFinite(lineUnitPrice(line)) || !(lineUnitPrice(line) > 0)) return fail('unpriced');
  return { line, issue: null, unavailable };
}

export type CartEditResult = { saved: true; items: CartItem[] } | { saved: false; issue: CartEditIssue };

/** Everything the sheet must disclose before a merge, including repricing
 * existing units. The destination snapshot also guards render-to-Save races. */
export interface CartEditCollision {
  lineId: string;
  destinationQty: number;
  destinationUnitPrice: number;
  mergedQty: number;
  unitPrice: number;
  total: number;
}

export function cartEditCollision(
  items: readonly CartItem[],
  original: CartItem,
  line: CartItem,
): CartEditCollision | null {
  const destination = items.find((l) => l.lineId === line.lineId && l.lineId !== original.lineId);
  if (!destination) return null;
  const mergedQty = destination.qty + line.qty;
  const unitPrice = lineUnitPrice(line);
  return {
    lineId: destination.lineId,
    destinationQty: destination.qty,
    destinationUnitPrice: lineUnitPrice(destination),
    mergedQty,
    unitPrice,
    total: mergedQty * unitPrice,
  };
}

/** Replace one configured line in one store update. A missing/changed source
 * must never turn Save into Add, and an identical destination combines qty.
 * Menu objects and prices in a persisted cart/draft are never authoritative. */
export function saveCartEdit(
  items: CartItem[],
  original: CartItem,
  draft: CartEditDraft,
  menu: readonly MenuItem[],
  quotedUnitPrice: number,
  quotedCollision: CartEditCollision | null,
): CartEditResult {
  const source = items.find((l) => l.lineId === original.lineId);
  if (!source || source.qty !== original.qty) return { saved: false, issue: 'lineChanged' };
  const resolved = resolveCartEdit(menu.find((m) => m.id === original.itemId), draft);
  if (!resolved.line) return { saved: false, issue: resolved.issue! };
  const line = resolved.line;
  // A feed update can land between render and click. Keep the cart and ask
  // for another Save after the sheet has shown the refreshed price.
  if (Math.abs(lineUnitPrice(line) - quotedUnitPrice) > 0.000001 || !Number.isFinite(quotedUnitPrice)) {
    return { saved: false, issue: 'menuChanged' };
  }
  const collision = cartEditCollision(items, original, line);
  if (collision?.lineId !== quotedCollision?.lineId
    || collision?.destinationQty !== quotedCollision?.destinationQty
    || collision?.destinationUnitPrice !== quotedCollision?.destinationUnitPrice
    || collision?.mergedQty !== quotedCollision?.mergedQty
    || collision?.unitPrice !== quotedCollision?.unitPrice
    || collision?.total !== quotedCollision?.total) {
    return { saved: false, issue: 'mergeChanged' };
  }
  if (collision) {
    return {
      saved: true,
      items: items.filter((l) => l.lineId !== original.lineId).map((l) =>
        l.lineId === collision.lineId ? { ...line, qty: collision.mergedQty } : l,
      ),
    };
  }
  return { saved: true, items: items.map((l) => l.lineId === original.lineId ? line : l) };
}
