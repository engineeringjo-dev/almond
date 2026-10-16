import { useState } from 'react';
import { router } from 'expo-router';

import { PhotoTile } from '@/components/home/PhotoTile';
import { campaignPhotos } from '@/components/home/campaignPhotos';
import { OrderTypeSheet } from '@/components/order/OrderTypeSheet';
import { useI18n } from '@/hooks/useI18n';
import { useMenuState } from '@/hooks/useMenuState';
import { formatJOD } from '@/lib/format';
import { useCartStore, useCartCount, computeTotals } from '@/stores/cartStore';
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
 * The empty-order action uses the owner's extracted Almond cup: recognisable
 * brand art for the whole menu, without implying the pictured combo is the
 * only way to order. The existing 72pt action is not made taller. A live cart
 * still shows its own first item and opens the existing cart review.
 */
export function OrderNowButton({ branch }: { branch?: Branch }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const menu = useMenuState();
  const items = useCartStore((s) => s.items);
  const count = useCartCount();

  if (count > 0) {
    const total = computeTotals(items, 0).total;
    const lead = menu.items.find((m) => m.id === items[0]?.itemId);
    return (
      <PhotoTile
        titleVariant="h2"
        variant="order"
        title={t('home.continueOrder')}
        subtitle={t('home.cartLine', { count, total: formatJOD(total, lang) })}
        photos={[lead?.imageUrl]}
        icon="cart"
        plate={72}
        onPress={() => router.push('/cart')}
      />
    );
  }

  const branchName = branch ? (lang === 'ar' ? branch.nameAr : branch.nameEn) : null;
  return (
    <>
      <PhotoTile
        titleVariant="h2"
        variant="order"
        title={t('home.quickOrder')}
        subtitle={branchName ? t('home.pickupAt', { branch: branchName }) : undefined}
        artwork={campaignPhotos.cup}
        icon="coffee"
        plate={72}
        onPress={() => setOpen(true)}
      />
      <OrderTypeSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
