import { StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { PhotoTile } from '@/components/home/PhotoTile';
import { spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useMenuState } from '@/hooks/useMenuState';
import { useUsualOrder } from '@/hooks/useOrder';
import { useCartStore, lineUnitPrice } from '@/stores/cartStore';
import { iconForItem } from '@/lib/productIcon';
import { formatJOD } from '@/lib/format';

/**
 * «طلبك المعتاد» — the order a member places most, back in the cart in one
 * tap (section 4.4 #3, 7.2), with a photograph of what is in it. Expert panel,
 * 2026-10-15: «اطلب مجدداً بصورة آخر طلب». Precedent: Starbucks' and Talabat's
 * "Order again", which show the item, not only its name.
 *
 * It renders nothing for a member with no orders yet, and carries its own
 * margin for that reason: a wrapper on Home would leave the gap behind.
 */
export function UsualOrderCard() {
  const { t, lang } = useI18n();
  const usual = useUsualOrder();
  const menu = useMenuState();
  const addLine = useCartStore((s) => s.addLine);

  if (!usual) return null;

  const names = usual.items
    .map((i) => {
      const name = lang === 'ar' ? i.nameAr : i.nameEn;
      return i.qty > 1 ? `${name} ×${i.qty}` : name;
    })
    .join(lang === 'ar' ? '، ' : ', ');
  const total = usual.items.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0);
  const photos = usual.items.map((i) => menu.items.find((m) => m.id === i.itemId)?.imageUrl).filter(Boolean);

  const addAll = () => {
    usual.items.forEach((i) => addLine({ ...i }));
    router.push('/cart');
  };

  return (
    <PhotoTile
      title={t('home.usualOrder')}
      subtitle={names}
      cta={t('home.usualAdd', { total: formatJOD(total, lang) })}
      photos={photos}
      icon={iconForItem(usual.items[0]?.itemId ?? '')}
      plate={96}
      onPress={addAll}
      style={styles.block}
    />
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.lg },
});
