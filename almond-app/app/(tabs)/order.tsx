import { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { SearchBar } from '@/components/ui/SearchBar';
import { CategoryChips } from '@/components/menu/CategoryChips';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { ItemModal } from '@/components/menu/ItemModal';
import { PickupCartBar } from '@/components/order/PickupCartBar';
import { Logo } from '@/components/ui/Logo';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useCategories, useMenuItems } from '@/hooks/useMenu';
import { useOrderHistory } from '@/hooks/useOrder';
import { formatJOD, formatDate } from '@/lib/format';
import { iconForCategory, iconForItem } from '@/lib/productIcon';
import { useFavouritesStore } from '@/stores/favouritesStore';
import { useCartStore } from '@/stores/cartStore';
import { useToastStore } from '@/stores/toastStore';
import type { MenuItem, Order, CartItem } from '@/types';

type SubTab = 'menu' | 'featured' | 'previous' | 'favourites';

// Logical order; RTL flips the row so "Menu" sits right-most in Arabic (§2.1).
const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'menu', label: 'order.tabMenu' },
  { id: 'featured', label: 'order.tabFeatured' },
  { id: 'previous', label: 'order.tabPrevious' },
  { id: 'favourites', label: 'order.tabFavourites' },
];

// A small, curated "trending" set for the Menu strip (§2.2).
const TRENDING_IDS = ['latte', 'iced-latte', 'cappuccino', 'frappuccino', 'matcha-iced', 'cold-brew'];

export default function OrderScreen() {
  const { t } = useI18n();
  const [tab, setTab] = useState<SubTab>('menu');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const categoriesQuery = useCategories();
  const itemsQuery = useMenuItems('all');

  const loading = categoriesQuery.isLoading || itemsQuery.isLoading;
  const error = categoriesQuery.isError || itemsQuery.isError;

  if (loading || error) {
    return <Screen loading={loading} error={error} onRetry={itemsQuery.refetch} />;
  }

  const items: MenuItem[] = itemsQuery.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Logo variant="badge" tone="dark" size={28} />
          <Text variant="h1">{t('tabs.order')}</Text>
        </View>
      </View>

      {/* Top sub-tabs */}
      <View style={styles.subTabs}>
        {SUB_TABS.map((s) => {
          const active = s.id === tab;
          return (
            <Pressable
              key={s.id}
              onPress={() => setTab(s.id)}
              style={styles.subTab}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text variant="bodyBold" color={active ? colors.primary : colors.warmGray}>
                {t(s.label)}
              </Text>
              <View style={[styles.subTabUnderline, active && styles.subTabUnderlineActive]} />
            </Pressable>
          );
        })}
      </View>

      {tab === 'menu' ? (
        <MenuTab
          items={items}
          categories={categoriesQuery.data ?? []}
          onSelect={setSelectedItem}
        />
      ) : null}
      {tab === 'featured' ? <FeaturedTab items={items} onSelect={setSelectedItem} /> : null}
      {tab === 'previous' ? <PreviousTab /> : null}
      {tab === 'favourites' ? (
        <FavouritesTab items={items} onSelect={setSelectedItem} onBrowse={() => setTab('menu')} />
      ) : null}

      <ItemModal
        item={selectedItem}
        visible={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />

      {/* Persistent pickup-store + cart bar (Starbucks pattern) */}
      <PickupCartBar />
    </SafeAreaView>
  );
}

/* ----------------------------- Menu sub-tab ----------------------------- */

function MenuTab({
  items,
  categories,
  onSelect,
}: {
  items: MenuItem[];
  categories: { id: string; nameAr: string; nameEn: string }[];
  onSelect: (i: MenuItem) => void;
}) {
  const { t, lang } = useI18n();
  const [activeCat, setActiveCat] = useState('all');
  const [query, setQuery] = useState('');

  const trending = useMemo(
    () => TRENDING_IDS.map((id) => items.find((i) => i.id === id)).filter(Boolean) as MenuItem[],
    [items],
  );

  const displayed = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return items.filter(
        (i) =>
          i.nameAr.toLowerCase().includes(q) ||
          i.nameEn.toLowerCase().includes(q) ||
          (i.descEn ?? '').toLowerCase().includes(q),
      );
    }
    if (activeCat === 'all') return items;
    return items.filter((i) => i.categoryId === activeCat);
  }, [items, query, activeCat]);

  return (
    <FlatList
      data={displayed}
      keyExtractor={(i) => i.id}
      numColumns={2}
      columnWrapperStyle={styles.column}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.menuHeader}>
          <SearchBar value={query} onChangeText={setQuery} placeholder={t('menu.searchPlaceholder')} />

          {!query && trending.length > 0 ? (
            <View style={styles.block}>
              <Text variant="title" style={styles.blockTitle}>
                {t('order.trending')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendRow}>
                {trending.map((item) => (
                  <Pressable key={item.id} style={styles.trendItem} onPress={() => onSelect(item)}>
                    <View style={styles.trendThumb}>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.trendPhoto} resizeMode="cover" />
                      ) : (
                        <Icon name={iconForCategory(item.categoryId)} size={30} color={colors.brown} strokeWidth={1.6} />
                      )}
                    </View>
                    <Text variant="caption" numberOfLines={1} style={styles.trendLabel}>
                      {lang === 'ar' ? item.nameAr : item.nameEn}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {!query ? (
            <View style={styles.chips}>
              <CategoryChips categories={categories} activeId={activeCat} onSelect={setActiveCat} />
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item, index }) => (
        <FadeIn delay={Math.min(index, 8) * 30} style={styles.cardWrap}>
          <MenuItemCard item={item} onPress={() => onSelect(item)} />
        </FadeIn>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text variant="body" color={colors.warmGray}>
            {t('menu.noResults')}
          </Text>
        </View>
      }
    />
  );
}

/* --------------------------- Featured sub-tab --------------------------- */

function FeaturedTab({ items, onSelect }: { items: MenuItem[]; onSelect: (i: MenuItem) => void }) {
  const { t } = useI18n();
  const brunch = useMemo(() => items.filter((i) => i.isBrunch), [items]);
  // "Seasonal collection": matcha + chocolate specials as a curated set.
  const seasonal = useMemo(
    () => items.filter((i) => i.categoryId === 'matcha' || i.categoryId === 'chocolate'),
    [items],
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
      {/* Seasonal collections */}
      <View style={styles.block}>
        <Text variant="title" style={styles.blockTitle}>
          {t('order.featuredTitle')}
        </Text>
        <Text variant="caption" color={colors.warmGray} style={styles.blockSub}>
          {t('order.featuredSubtitle')}
        </Text>
        {seasonal.length > 0 ? (
          <View style={styles.grid}>
            {seasonal.map((item) => (
              <View key={item.id} style={styles.gridCell}>
                <MenuItemCard item={item} onPress={() => onSelect(item)} />
              </View>
            ))}
          </View>
        ) : (
          <Text variant="caption" color={colors.warmGray}>
            {t('order.emptyFeatured')}
          </Text>
        )}
      </View>

      {/* Brunch BR offers */}
      <View style={styles.block}>
        <Text variant="title" style={styles.blockTitle}>
          {t('order.brunchTitle')}
        </Text>
        <Text variant="caption" color={colors.warmGray} style={styles.blockSub}>
          {t('order.brunchSubtitle')}
        </Text>
        <View style={styles.grid}>
          {brunch.map((item) => (
            <View key={item.id} style={styles.gridCell}>
              <MenuItemCard item={item} onPress={() => onSelect(item)} />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

/* --------------------------- Previous sub-tab --------------------------- */

function PreviousTab() {
  const { t, lang } = useI18n();
  const { data, isLoading, isError, refetch } = useOrderHistory();
  const addLine = useCartStore((s) => s.addLine);
  const showAdded = useToastStore((s) => s.showAdded);

  if (isLoading || isError) {
    return <Screen loading={isLoading} error={isError} onRetry={refetch} />;
  }

  const orders: Order[] = data ?? [];
  if (orders.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <EmptyState
          icon="history"
          title={t('order.emptyPrevious')}
          subtitle={t('order.emptyPreviousHint')}
          ctaLabel={t('track.noOrdersCta')}
          onCta={() => router.push('/(tabs)/order')}
        />
      </View>
    );
  }

  const reorder = (order: Order) => {
    // Re-add every line with its exact size + customizations (§2.5).
    order.items.forEach((line: CartItem) => addLine({ ...line }));
    const first = order.items[0];
    if (first) showAdded({ itemId: first.itemId, nameAr: first.nameAr, nameEn: first.nameEn });
    router.push('/(tabs)/cart');
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
      {orders.map((o) => (
        <Card key={o.id} style={styles.prevCard}>
          <View style={styles.prevHead}>
            <Text variant="bodyBold">
              {t('track.orderNumber')} {o.id.slice(-6).toUpperCase()}
            </Text>
            <Text variant="caption" color={colors.warmGray}>
              {formatDate(o.createdAt, lang)}
            </Text>
          </View>
          <View style={styles.prevItems}>
            {o.items.map((line) => (
              <View key={line.lineId} style={styles.prevItemRow}>
                <View style={styles.prevThumb}>
                  <Icon name={iconForItem(line.itemId)} size={18} color={colors.brown} strokeWidth={1.8} />
                </View>
                <Text variant="caption" numberOfLines={1} style={styles.flex}>
                  {line.qty}× {lang === 'ar' ? line.nameAr : line.nameEn}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.prevFoot}>
            <Text variant="price">{formatJOD(o.total, lang)}</Text>
            <Button
              title={t('order.reorder')}
              variant="outline"
              fullWidth={false}
              leadingEmoji="🔁"
              onPress={() => reorder(o)}
            />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

/* -------------------------- Favourites sub-tab -------------------------- */

function FavouritesTab({
  items,
  onSelect,
  onBrowse,
}: {
  items: MenuItem[];
  onSelect: (i: MenuItem) => void;
  onBrowse: () => void;
}) {
  const { t } = useI18n();
  const favIds = useFavouritesStore((s) => s.ids);
  const favs = useMemo(() => items.filter((i) => favIds.includes(i.id)), [items, favIds]);

  if (favs.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <EmptyState
          icon="heart"
          title={t('order.emptyFav')}
          subtitle={t('order.emptyFavHint')}
          ctaLabel={t('order.tabMenu')}
          onCta={onBrowse}
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
      <Text variant="caption" color={colors.warmGray} style={styles.favIntro}>
        {t('order.favouritesSubtitle')}
      </Text>
      <View style={styles.grid}>
        {favs.map((item) => (
          <View key={item.id} style={styles.gridCell}>
            <MenuItemCard item={item} onPress={() => onSelect(item)} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subTabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutralWarm,
  },
  subTab: { alignItems: 'center', paddingBottom: spacing.sm },
  subTabUnderline: {
    height: 3,
    width: '100%',
    borderRadius: 2,
    marginTop: spacing.sm,
    backgroundColor: 'transparent',
  },
  subTabUnderlineActive: { backgroundColor: colors.primary },

  menuHeader: { gap: spacing.md, marginBottom: spacing.sm },
  block: { marginTop: spacing.md },
  blockTitle: { marginBottom: spacing.xs },
  blockSub: { marginBottom: spacing.md },
  chips: {},

  trendRow: { gap: spacing.md, paddingEnd: spacing.lg },
  trendItem: { alignItems: 'center', width: 72, gap: spacing.xs },
  trendThumb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.card,
  },
  trendPhoto: { width: '100%', height: '100%' },
  trendLabel: { textAlign: 'center' },

  // extra bottom room so content clears the pinned pickup/cart bar
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 4 },
  scrollList: { padding: spacing.lg, paddingBottom: spacing.xxl * 4 },
  column: { gap: spacing.md },
  cardWrap: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridCell: { width: '47.5%', flexGrow: 1 },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2, gap: spacing.md },
  emptyEmoji: { fontSize: 44 },
  emptyWrap: { flex: 1 },
  flex: { flex: 1 },

  prevCard: { marginBottom: spacing.md, gap: spacing.md },
  prevHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prevItems: { gap: spacing.xs },
  prevItemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prevThumb: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  favIntro: { marginBottom: spacing.md },
});
