import type { Metadata } from 'next';
import { getAllItems } from '@/data/menu';
import { AdminGate } from '@/components/admin/AdminGate';
import { MenuEditor, type AdminItem } from '@/components/admin/MenuEditor';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default function AdminPage() {
  const items: AdminItem[] = getAllItems().map((i) => ({
    id: i.id,
    nameAr: i.nameAr,
    nameEn: i.nameEn,
    basePrice: i.sizes[0]?.price ?? 0,
    inStock: i.inStock !== false,
  }));

  return (
    <AdminGate>
      <MenuEditor items={items} />
    </AdminGate>
  );
}
