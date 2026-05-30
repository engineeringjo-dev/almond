import type { MenuService } from './menu.service';
import type { Category, MenuItem } from '@/types';
import { config } from '@/constants/config';

/**
 * Odoo 19 menu implementation (section 6.3). Endpoints are not yet confirmed,
 * so method bodies are stubbed with the intended call signatures. The mock
 * stays the active source until DATA_SOURCE === 'odoo'.
 *
 * Odoo 19 likely exposes JSON-RPC at /web/dataset/call_kw and/or a custom REST
 * controller. Auth via API key or session (configurable env var).
 */
async function callKw<T>(model: string, method: string, args: unknown[]): Promise<T> {
  // TODO: confirm Odoo endpoint + auth scheme.
  const res = await fetch(`${config.ODOO_BASE_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs: {} },
    }),
  });
  const json = await res.json();
  return json.result as T;
}

export const odooMenuService: MenuService = {
  // TODO: confirm Odoo endpoint — map product.category records to Category.
  getCategories: () => callKw<Category[]>('product.category', 'search_read', []),

  // TODO: confirm Odoo endpoint — Price2 column is authoritative (section 2.5).
  getItems: (categoryId) =>
    callKw<MenuItem[]>('product.template', 'search_read', [
      categoryId && categoryId !== 'all' ? [['categ_id', '=', categoryId]] : [],
    ]),

  getItem: (id) =>
    callKw<MenuItem[]>('product.template', 'search_read', [[['id', '=', id]]]).then(
      (rows) => rows[0],
    ),

  // TODO: confirm Odoo endpoint — server-side name search.
  searchItems: (query) =>
    callKw<MenuItem[]>('product.template', 'search_read', [
      ['|', ['name', 'ilike', query], ['default_code', 'ilike', query]],
    ]),
};
