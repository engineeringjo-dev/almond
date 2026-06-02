import { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatJOD } from '@/lib/format';
import { iconForCategory } from '@/lib/productIcon';
import { getSizeUpsell, getItemPairings } from '@/lib/recommendations';
import { useCartStore } from '@/stores/cartStore';
import type { MenuItem, ItemSize, CartCustomization } from '@/types';

interface Props {
  item: MenuItem | null;
  visible: boolean;
  onClose: () => void;
}

/** Item customization bottom sheet (section 4.5). */
export function ItemModal({ item, visible, onClose }: Props) {
  const { t, lang } = useI18n();
  const addItem = useCartStore((s) => s.addItem);
  const [sizeId, setSizeId] = useState<ItemSize['id']>('M');
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [pairAdded, setPairAdded] = useState<Record<string, boolean>>({});

  // Reset state whenever a new item opens; default single-choice to first option.
  useEffect(() => {
    if (!item) return;
    setSizeId(item.sizes[0].id);
    setQty(1);
    const init: Record<string, string[]> = {};
    item.customizations.forEach((g) => {
      init[g.id] = g.multiple ? [] : [g.options[0].id];
    });
    setSelected(init);
  }, [item]);

  const size = useMemo(
    () => item?.sizes.find((s) => s.id === sizeId) ?? item?.sizes[0],
    [item, sizeId],
  );

  const customizations = useMemo<CartCustomization[]>(() => {
    if (!item) return [];
    const out: CartCustomization[] = [];
    item.customizations.forEach((g) => {
      (selected[g.id] ?? []).forEach((optId) => {
        const opt = g.options.find((o) => o.id === optId);
        if (opt) out.push({ groupId: g.id, optionId: opt.id, nameAr: opt.nameAr, nameEn: opt.nameEn, priceDelta: opt.priceDelta });
      });
    });
    return out;
  }, [item, selected]);

  const unit = (size?.price ?? 0) + customizations.reduce((s, c) => s + c.priceDelta, 0);
  const total = unit * qty;

  if (!item || !size) return null;

  // Upsell + cross-sell (Starbucks-style).
  const upsell = getSizeUpsell(item, sizeId);
  const pairings = getItemPairings(item, 4);

  const toggle = (groupId: string, optId: string, multiple: boolean) => {
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (multiple) {
        return {
          ...prev,
          [groupId]: current.includes(optId)
            ? current.filter((x) => x !== optId)
            : [...current, optId],
        };
      }
      return { ...prev, [groupId]: [optId] };
    });
  };

  const onAdd = () => {
    addItem(item, size, customizations, qty);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      footer={
        <Button title={`${t('menu.addToCart')} · ${formatJOD(total, lang)}`} onPress={onAdd} />
      }
    >
      <View style={styles.header}>
        <View style={styles.thumb}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.photo} resizeMode="cover" />
          ) : (
            <Icon name={iconForCategory(item.categoryId)} size={52} color={colors.brown} strokeWidth={1.6} />
          )}
        </View>
        <Text variant="h2">{lang === 'ar' ? item.nameAr : item.nameEn}</Text>
        <Text variant="caption" color={colors.warmGray}>
          {lang === 'ar' ? item.nameEn : item.nameAr}
        </Text>
        {item.descAr ? (
          <Text variant="body" color={colors.warmGray} center style={styles.desc}>
            {lang === 'ar' ? item.descAr : item.descEn}
          </Text>
        ) : null}
      </View>

      {item.isBrunch ? (
        <View style={styles.brunchBanner}>
          <Text variant="caption" color={colors.dark}>
            🍳 {t('menu.brunchOffer')}
          </Text>
        </View>
      ) : null}

      {item.sizes.length > 1 ? (
        <Section title={t('menu.size')}>
          <View style={styles.optionRow}>
            {item.sizes.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.sizeChip, s.id === sizeId && styles.sizeChipActive]}
                onPress={() => setSizeId(s.id)}
              >
                <Text variant="bodyBold" color={s.id === sizeId ? colors.dark : colors.warmGray}>
                  {lang === 'ar' ? s.nameAr : s.nameEn}
                </Text>
                <Text variant="caption" color={s.id === sizeId ? colors.dark : colors.warmGray}>
                  {formatJOD(s.price, lang)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}

      {/* Size upsell (Starbucks "upsize") */}
      {upsell ? (
        <Pressable style={styles.upsell} onPress={() => setSizeId(upsell.size.id)}>
          <Text style={styles.upsellIcon}>⬆️</Text>
          <Text variant="bodyBold" color={colors.dark} style={styles.flex}>
            {t('menu.upsize', {
              size: lang === 'ar' ? upsell.size.nameAr : upsell.size.nameEn,
              delta: formatJOD(upsell.delta, lang),
            })}
          </Text>
        </Pressable>
      ) : null}

      {item.customizations.map((g) => (
        <Section key={g.id} title={lang === 'ar' ? g.nameAr : g.nameEn}>
          <View style={styles.optionWrap}>
            {g.options.map((o) => {
              const isSel = (selected[g.id] ?? []).includes(o.id);
              return (
                <Pressable
                  key={o.id}
                  style={[styles.optChip, isSel && styles.optChipActive]}
                  onPress={() => toggle(g.id, o.id, g.multiple)}
                >
                  <Text variant="caption" color={isSel ? colors.dark : colors.warmGray}>
                    {lang === 'ar' ? o.nameAr : o.nameEn}
                    {o.priceDelta > 0 ? ` +${formatJOD(o.priceDelta, lang)}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>
      ))}

      <Section title={t('menu.quantity')}>
        <Stepper value={qty} onChange={setQty} />
      </Section>

      {/* Cross-sell: goes great with */}
      {pairings.length > 0 ? (
        <Section title={t('menu.pairsWith')}>
          <View style={styles.pairWrap}>
            {pairings.map((p) => {
              const isAdded = pairAdded[p.id];
              return (
                <Pressable
                  key={p.id}
                  style={[styles.pairChip, isAdded && styles.pairChipAdded]}
                  onPress={() => {
                    addItem(p, p.sizes[0], [], 1);
                    setPairAdded((prev) => ({ ...prev, [p.id]: true }));
                  }}
                >
                  <Icon name={iconForCategory(p.categoryId)} size={18} color={isAdded ? colors.white : colors.primary} strokeWidth={1.8} />
                  <Text variant="caption" color={isAdded ? colors.white : colors.dark}>
                    {lang === 'ar' ? p.nameAr : p.nameEn}
                  </Text>
                  <Text variant="caption" color={isAdded ? colors.white : colors.gold}>
                    {isAdded ? t('menu.added') : `+${formatJOD(Math.min(...p.sizes.map((s) => s.price)), lang)}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>
      ) : null}
    </BottomSheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="bodyBold" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 2, marginBottom: spacing.md },
  thumb: {
    width: 96, height: 96, borderRadius: radius.lg, backgroundColor: colors.cream,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  desc: { marginTop: spacing.sm },
  brunchBanner: {
    backgroundColor: colors.lightGold,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  flex: { flex: 1 },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.lightGold,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  upsellIcon: { fontSize: 16 },
  pairWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pairChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.lightGold,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pairChipAdded: { backgroundColor: colors.green, borderColor: colors.green },
  section: { marginBottom: spacing.lg },
  sectionTitle: { marginBottom: spacing.sm },
  optionRow: { flexDirection: 'row', gap: spacing.sm },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sizeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  sizeChipActive: { borderColor: colors.gold, backgroundColor: colors.lightGold },
  optChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optChipActive: { borderColor: colors.gold, backgroundColor: colors.lightGold },
});
