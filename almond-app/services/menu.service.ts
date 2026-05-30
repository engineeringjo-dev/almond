import type { Category, MenuItem } from '@/types';
import { config } from '@/constants/config';
import { mockMenuService } from './menu.service.mock';
import { odooMenuService } from './menu.service.odoo';

export interface MenuService {
  getCategories(): Promise<Category[]>;
  getItems(categoryId?: string): Promise<MenuItem[]>;
  getItem(id: string): Promise<MenuItem>;
  searchItems(query: string): Promise<MenuItem[]>;
}

// index picks the active implementation based on config.DATA_SOURCE (section 6.2).
export const menuService: MenuService =
  config.DATA_SOURCE === 'odoo' ? odooMenuService : mockMenuService;
