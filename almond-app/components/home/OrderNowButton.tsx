import { useMemo, useState } from 'react';
import { router } from 'expo-router';

import { PhotoTile } from '@/components/home/PhotoTile';
import { OrderTypeSheet } from '@/components/order/OrderTypeSheet';
import { useI18n } from '@/hooks/useI18n';
import { useMenuState } from '@/hooks/useMenuState';
import { formatJOD } from '@/lib/format';
import { useCartStore, useCartCount, computeTotals } from '@/stores/cartStore';
import { bestSellers } from '@almond/shared/lib/recommendations';
import type { Branch } from '@/types';

/**
 * Home's second block: «اطلب الآن», with the branch the order will be picked
 * up from, or «أكمل طلبك» once something is in the cart.
 *
 * The second form is how the cart is reached from Home now that the header has
 * no cart icon (expert panel, 2026-10-15: a lighter header, one way to each
 * thing). Precedent: Talabat and Deliveroo, whose basket button appears only
 * when there is something in it. An empty cart has nothing to return to, so
 * it offers the order instead: the chooser first (pickup here, delivery
 * outside), as before.
 *
 * The photograph is the second most ordered drink. The first is already the
 * carousel's best-seller slide just below, and the same cup twice on one
 * screen reads as a mistake.
 */
export function OrderNowButton({ branch }: { branch?: Branch }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const menu = useMenuState();
  const items = useCartStore((s) => s.items);
  const count = useCartCount();

  const photo = useMemo(() => {
    const [first, second] = bestSellers(2, { kind: 'drink', items: menu.items });
    return (second ?? first)?.imageUrl;
  }, [menu.items]);

  if (count > 0) {
    const total = computeTotals(items, 0).total;
    const lead = menu.items.find((m) => m.id === items[0]?.itemId);
    return (
      <PhotoTile
        titleVariant="h2"
        title={t('home.continueOrder')}
        subtitle={t('home.cartLine', { count, total: formatJOD(total, lang) })}
        photos={[lead?.imageUrl]}
        icon="cart"
        plate={84}
        onPress={() => router.push('/cart')}
      />
    );
  }

  const branchName = branch ? (lang === 'ar' ? branch.nameAr : branch.nameEn) : null;
  return (
    <>
      <PhotoTile
        titleVariant="h2"
        title={t('home.quickOrder')}
        subtitle={branchName ? t('home.pickupAt', { branch: branchName }) : undefined}
        photos={[photo]}
        icon="coffee"
        plate={84}
        onPress={() => setOpen(true)}
      />
      <OrderTypeSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
