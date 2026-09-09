import type { Metadata } from 'next';
import { getAllItems } from '@/data/menu';
import { isAdmin, adminConfigured } from '@/server/admin';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { BackOffice } from '@/components/admin/BackOffice';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

/**
 * 🔴 THE GATE IS ON THE SERVER NOW, AND THE PAGE BEHIND IT IS NEVER RENDERED
 * FOR A STRANGER.
 *
 * It used to be `<AdminGate>` — a client component comparing a password that
 * `NEXT_PUBLIC_ADMIN_PASS` had already shipped into the browser bundle
 * (defaulting to the literal 'almond'), with `authed: true` persisted to
 * localStorage where anyone could write it. The markup behind it was sent to
 * every visitor regardless; only its visibility was gated.
 *
 * `isAdmin()` reads an httpOnly, signed, expiring cookie. A visitor without one
 * receives the login form and nothing else — not the tabs, not the register,
 * not a single company name.
 */
export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin configured={adminConfigured()} />;

  // Computed on the SERVER from the shared menu — the same source the pull
  // writes — so the count cannot disagree with what the app and website show.
  const items = getAllItems();

  return (
    <BackOffice
      menuItemCount={items.length}
      itemsWithoutPhoto={items.filter((i) => !i.imageUrl).length}
      menuItems={items.map((i) => ({
        id: i.id, nameAr: i.nameAr, nameEn: i.nameEn,
        basePrice: i.sizes[0]?.price ?? 0, inStock: i.inStock !== false,
      }))}
    />
  );
}
