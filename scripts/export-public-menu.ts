/**
 * Writes the public menu feed as a static bundle — for a website that would
 * rather host the menu itself than call GET /api/public/menu:
 *
 *   npx tsx scripts/export-public-menu.ts [--out dist/public-menu] [--base https://…]
 *
 *   <out>/menu.json     — exactly the body GET /api/public/menu serves
 *   <out>/menu/*.webp   — the photos it references
 *
 * --base is the origin the photos will be served from; image_url becomes
 * `<base>/menu/p-123.webp`. Default: the live website preview, so the file
 * works as-is. Reads only the committed menu module — no Odoo, no key.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPublicMenuFeed } from '../packages/shared/src/menu/publicFeed';
import { generatedCategories, generatedMenuItems, menuPulledAt } from '../packages/shared/src/menu/menu.generated';
import { insightsWindow, itemInsights, modifierProducts } from '../packages/shared/src/menu/menu.insights.generated';
import { config } from '../packages/shared/src/config';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const out = arg('out', join('dist', 'public-menu'));
const base = arg('base', 'https://almond-gules.vercel.app').replace(/\/+$/, '');

const feed = buildPublicMenuFeed({
  categories: generatedCategories,
  items: generatedMenuItems,
  updatedAt: menuPulledAt,
  assetBase: base,
  taxRate: config.TAX_RATE,
  pricesIncludeTax: config.PRICES_TAX_INCLUSIVE,
  insights: { window: insightsWindow, modifiers: modifierProducts, items: itemInsights },
});

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'menu'), { recursive: true });
writeFileSync(join(out, 'menu.json'), `${JSON.stringify(feed, null, 2)}\n`);
let photos = 0;
for (const item of generatedMenuItems) {
  if (!item.imageUrl) continue;
  cpSync(join('almond-web', 'public', item.imageUrl), join(out, item.imageUrl));
  photos++;
}
console.log(`${out}: ${feed.items.length} items, ${feed.categories.length} categories, `
  + `${feed.option_groups.length} option groups, ${photos} photos (image base ${base})`);
