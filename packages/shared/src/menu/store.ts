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
  current = { categories: p.categories, items: p.items, version: p.version, source };
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
