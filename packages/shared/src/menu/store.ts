/**
 * THE MENU IN USE — the bundled Odoo menu until a newer one arrives from the
 * server (menu/remote.ts). Everything that shows or suggests items reads
 * `getMenu()` at call time, so a menu fetched after launch reaches every screen.
 *
 * The server's re-price does NOT read this: it prices from its own bundled
 * menu, which it gets by redeploying on every push (the same push that updates
 * the endpoint), so the price charged is always the server's.
 */
import type { Category, MenuItem } from '../types';
import { categories as bundledCategories, menuItems as bundledItems } from './seed';
import { localizeCategories, localizeMenuItems } from './localize';
import type { AppMenuPayload } from './remote';

export interface MenuState {
  categories: Category[];
  items: MenuItem[];
  /** 'bundled' until a server payload is applied; then its content hash. */
  version: string;
  source: 'bundled' | 'cache' | 'server';
}

let current: MenuState = { categories: bundledCategories, items: bundledItems, version: 'bundled', source: 'bundled' };
const listeners = new Set<(m: MenuState) => void>();

export function getMenu(): MenuState {
  return current;
}

/** Apply a payload that `parseAppMenuPayload` accepted. Returns whether it changed anything. */
export function setMenu(p: AppMenuPayload, source: 'cache' | 'server'): boolean {
  if (p.version === current.version) return false;
  // 🔴 THE READER'S PASS RUNS ON EVERY MENU THAT REACHES A SCREEN, not only
  // on the bundled one (menu/localize.ts: Latin digits, Arabic names for the
  // modifiers Odoo has in English only). The server is a separate deployment
  // and can be older than this build: the 2026-10-15 end-to-end run fetched
  // the live menu, the cart printed «كرواسون مع أومليت و٣ أنواع جبن» beside
  // the chip's «و3», and an Arabic-Indic digit reached the screen again.
  // The pass is idempotent, so a server that already ran it costs nothing.
  current = {
    categories: localizeCategories(p.categories),
    items: localizeMenuItems(p.items),
    version: p.version,
    source,
  };
  for (const l of listeners) l(current);
  return true;
}

export function onMenuChange(listener: (m: MenuState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tests only: back to the bundled menu. */
export function resetMenuForTests(): void {
  current = { categories: bundledCategories, items: bundledItems, version: 'bundled', source: 'bundled' };
}
