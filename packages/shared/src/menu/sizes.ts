import type { CartItem, ItemSize, MenuItem } from '../types';

/** A size must identify one choice, never the first of several. The legacy
 * Odoo pull collapsed every fourth/later size to L; keep those rows visible
 * but unavailable until a source-backed PTAV identity migration is possible.
 * Follow-up: scripts/odoo-menu-pull.ts must retain PTAV IDs from a read-only
 * Odoo pull and migrate the S/M/L wire contract. The bundled snapshot has
 * discarded those source IDs, so names/prices/positions cannot restore them. */
export function resolveItemSize(item: Pick<MenuItem, 'sizes'> | null | undefined, sizeId: string): ItemSize | null {
  const matches = item?.sizes.filter((size) => size.id === sizeId) ?? [];
  return matches.length === 1 ? matches[0] : null;
}

/** Reorder is all-or-nothing: a saved unknown/ambiguous size needs the
 * customer's current selection before any of the old order joins the cart. */
export function canReorderSizes(lines: readonly Pick<CartItem, 'itemId' | 'sizeId'>[], menu: readonly MenuItem[]): boolean {
  return lines.every((line) => {
    const item = menu.find((candidate) => candidate.id === line.itemId);
    return item?.inStock !== false && resolveItemSize(item, line.sizeId) !== null;
  });
}

/** Atomic cart update for both clients. A rejected previous order leaves the
 * existing cart untouched; a valid one retains the established quantity merge. */
export function withReorderedLines(current: readonly CartItem[], lines: readonly CartItem[], menu: readonly MenuItem[]): CartItem[] | null {
  if (!lines.length || !canReorderSizes(lines, menu)) return null;
  const items = [...current];
  for (const line of lines) {
    const index = items.findIndex((existing) => existing.lineId === line.lineId);
    if (index < 0) items.push({ ...line });
    else items[index] = { ...items[index], qty: items[index].qty + line.qty };
  }
  return items;
}
