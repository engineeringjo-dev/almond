import type { Metadata } from 'next';
import { getMenuSections } from '@/data/menu';
import { MenuBrowser } from '@/components/menu/MenuBrowser';

export const metadata: Metadata = { title: 'Menu' };

export default function MenuPage() {
  // Strip the heavy per-item customization groups for the list payload — they're
  // only needed on the item page (getItemById). Quick-add uses no customizations.
  const sections = getMenuSections().map((s) => ({
    category: s.category,
    items: s.items.map((i) => ({ ...i, customizations: [] })),
  }));

  return <MenuBrowser sections={sections} />;
}
