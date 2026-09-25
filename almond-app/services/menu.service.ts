import type { Category, MenuItem } from '@/types';
import { bundledMenuService } from './menu.service.bundled';

export interface MenuService {
  getCategories(): Promise<Category[]>;
  getItems(categoryId?: string): Promise<MenuItem[]>;
  getItem(id: string): Promise<MenuItem>;
  searchItems(query: string): Promise<MenuItem[]>;
}

// One menu in every mode — the Odoo POS menu bundled from packages/shared
// (see menu.service.bundled.ts). DATA_SOURCE switches loyalty, orders and
// payments to the live server; it does not switch the menu to a different one.
export const menuService: MenuService = bundledMenuService;
