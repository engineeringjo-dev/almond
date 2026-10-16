import { useMemo, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, ScrollView, Pressable, Image, useWindowDimensions, type LayoutChangeEvent, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { SearchBar } from '@/components/ui/SearchBar';
import { CategoryChips } from '@/components/menu/CategoryChips';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { ItemModal } from '@/components/menu/ItemModal';
import { PickupCartBar } from '@/components/order/PickupCartBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { Skeleton } from '@/components/ui/Skeleton';
import { Screen } from '@/components/ui/Screen';
import { colors, layout, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useCategories, useMenuItems } from '@/hooks/useMenu';
import { useOrderHistory } from '@/hooks/useOrder';
import { MIN_TOUCH_TARGET, tabA11y } from '@/lib/a11y';
import { formatJOD, formatDate } from '@/lib/format';
import { menuImage } from '@/lib/menuImage';
import { PhotoDim } from '@/components/ui/PhotoDim';
import { iconForCategory, iconForItem } from '@/lib/productIcon';
import { useFavouritesStore } from '@/stores/favouritesStore';
import { useCartStore } from '@/stores/cartStore';
import { useToastStore } from '@/stores/toastStore';
import type { Category, MenuItem, Order, CartItem } from '@/types';
import { bestSellers } from '@almond/shared/lib/recommendations';
import { matchesMenuQuery } from '@almond/shared/menu/browse';
import { shouldWrapOrderTabs } from '@/lib/menuList';

type SubTab = 'menu' | 'featured' | 'previous' | 'favourites';

// Logical order; RTL flips the row so "Menu" sits right-most in Arabic (§2.1).
const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'menu', label: 'order.tabMenu' },
  { id: 'featured', label: 'order.tabFeatured' },
  { id: 'previous', label: 'order.tabPrevious' },
  { id: 'favourites', label: 'order.tabFavourites' },
];

// Category-name keywords used to surface the Featured tab's collections.
const SEASONAL_KW = /seasonal|new|autumn|spring|mother|ramadan|gift/i;
const HIGHLIGHT_KW = /croissant|sandwich|manaqeesh|bagel|pizza|cake|dessert/i;

export default function OrderScreen() {
  const { t, lang } = useI18n();
  const { width, fontScale } = useWindowDimensions();
  const wrapTabs = shouldWrapOrderTabs(width, fontScale, lang);
  const [tab, setTab] = useState<SubTab>('menu');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const categoriesQuery = useCategories();
  const itemsQuery = useMenuItems('all');

  const loading = categoriesQuery.isLoading || itemsQuery.isLoading;
  const error = categoriesQuery.isError || itemsQuery.isError;

  if (error) {
    return <Screen error onRetry={itemsQuery.refetch} />;
  }
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text variant="h1">{t('tabs.order')}</Text>
          </View>
        </View>
        <View style={styles.skeletonWrap}>
          <Skeleton height={46} pill />
          <View style={styles.skelChips}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} width={76} height={32} pill />)}
          </View>
          <View style={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={styles.gridCell}>
                <Skeleton height={150} />
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const items: MenuItem[] = itemsQuery.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text variant="h1">{t('tabs.order')}</Text>
        </View>
      </View>

      {/* Top sub-tabs: a tablist, so the open one is announced — the old
          accessibilityState never reached the web build. */}
      <View style={[styles.subTabs, wrapTabs && styles.subTabsWrapped]} role="tablist" aria-label={t('tabs.order')}>
        {SUB_TABS.map((s) => {
          const active = s.id === tab;
          return (
            <Pressable
              key={s.id}
              onPress={() => setTab(s.id)}
              style={[styles.subTab, wrapTabs && styles.subTabWrapped]}
              {...tabA11y(active, t(s.label))}
            >
              <Text variant="bodyBold" color={active ? colors.primary : colors.warmGray} center>
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
      {tab === 'featured' ? (
        <FeaturedTab items={items} categories={categoriesQuery.data ?? []} onSelect={setSelectedItem} />
      ) : null}
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

/**
 * ONE LIST, IN SECTIONS, UNDER A PINNED SECTION BAR (Dunkin' panel,
 * 2026-10-15). The bar was a filter in the list's header: it left with the
 * first swipe, showed 3 of 33 chips, and «الكل» was 375 tiles with no heading
 * — half of what sells sat 101 tiles (about 24 screens) down. Now every
 * section has its heading, the bar stays at the top of the list, a chip
 * jumps to its section, and the chip of the section in view is marked.
 * Precedent: Dunkin' 07, Talabat, Careem, Deliveroo, Uber Eats; the website's
 * CategoryRail. The search box stays above, and a query shows the matches
 * alone.
 */
/** The list's top padding: the first row's offset (getItemLayout). */
const LIST_PADDING_TOP = spacing.lg;

type MenuRow =
  | { type: 'top'; key: 'top' }
  | { type: 'bar'; key: 'bar' }
  | { type: 'section'; key: string; cat: Category }
  | { type: 'pair'; key: string; catId: string; items: MenuItem[] }
  | { type: 'empty'; key: 'empty' };

/** Two tiles a row: the grid, as a list a section heading can sit in. */
function pairsOf(items: MenuItem[]): MenuItem[][] {
  const out: MenuItem[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}

function MenuTab({
  items,
  categories,
  onSelect,
}: {
  items: MenuItem[];
  categories: Category[];
  onSelect: (i: MenuItem) => void;
}) {
  const { t, lang } = useI18n();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;

  // «الأكثر طلباً» means it: the items paid Odoo orders hold most, from the
  // one shared rule (bestSellers). It was the first photographed item of
  // each category, a sample under a heading that claimed a ranking.
  const trending = useMemo(() => bestSellers(12, { items }), [items]);

  // The sections in the shared order (menu/browse.ts, through the menu
  // service), each with its items; «الكل» is no section.
  const sections = useMemo(() => {
    const byCat = new Map<string, MenuItem[]>();
    for (const i of items) byCat.set(i.categoryId, [...(byCat.get(i.categoryId) ?? []), i]);
    return categories
      .filter((c) => c.id !== 'all' && (byCat.get(c.id)?.length ?? 0) > 0)
      .map((cat) => ({ cat, items: byCat.get(cat.id)! }));
  }, [items, categories]);

  const { rows, sectionAt } = useMemo(() => {
    const out: MenuRow[] = [{ type: 'top', key: 'top' }];
    const at = new Map<string, number>();
    if (searching) {
      const found = items.filter((i) => matchesMenuQuery(i, query));
      if (found.length === 0) out.push({ type: 'empty', key: 'empty' });
      pairsOf(found).forEach((pair, n) => out.push({ type: 'pair', key: `q:${n}`, catId: '', items: pair }));
      return { rows: out, sectionAt: at };
    }
    out.push({ type: 'bar', key: 'bar' });
    for (const s of sections) {
      at.set(s.cat.id, out.length);
      out.push({ type: 'section', key: `h:${s.cat.id}`, cat: s.cat });
      pairsOf(s.items).forEach((pair, n) => out.push({ type: 'pair', key: `p:${s.cat.id}:${n}`, catId: s.cat.id, items: pair }));
    }
    return { rows: out, sectionAt: at };
  }, [items, sections, query, searching]);

  const [active, setActive] = useState<string>(() => sections[0]?.cat.id ?? '');
  const listRef = useRef<FlatList<MenuRow>>(null);
  // A tap on a chip owns the marker until its scroll settles; the list's own
  // report of what is in view would otherwise flick through every section the
  // jump passes.
  const jumpUntil = useRef(0);

  // 🔴 EVERY ROW OF A KIND IS ONE HEIGHT, MEASURED ON SCREEN, so the list
  // knows where any section starts without drawing the rows above it. A
  // jump used to land short: React Native's list guesses the place of rows it
  // has not drawn, and a tap on «قطع كيك وحلويات» stopped at «ساندويشات».
  // Tiles keep a fixed name block (MenuItemCard), headings are one line, and
  // the first of each kind on screen reports its height here.
  const [heights, setHeights] = useState<Record<MenuRow['type'], number>>({
    top: 300,
    bar: 61,
    section: 70,
    pair: 300,
    empty: 200,
  });
  const measure = (type: MenuRow['type']) => (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeights((prev) => (Math.abs(prev[type] - h) < 0.01 ? prev : { ...prev, [type]: h }));
  };
  const offsets = useMemo(() => {
    const out: number[] = [];
    let y = LIST_PADDING_TOP;
    for (const r of rows) {
      out.push(y);
      y += heights[r.type];
    }
    return out;
  }, [rows, heights]);
  const getItemLayout = (_: ArrayLike<MenuRow> | null | undefined, index: number) => ({
    index,
    offset: offsets[index] ?? 0,
    length: heights[rows[index]?.type ?? 'pair'],
  });

  // The first section or tile at least half on screen names the section in
  // view. Stable for the list's lifetime, as FlatList requires.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (Date.now() < jumpUntil.current) return;
    const first = viewableItems
      .filter((v) => v.isViewable && v.index != null)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((v) => v.item as MenuRow)
      .find((r) => r.type === 'section' || (r.type === 'pair' && r.catId !== ''));
    if (first?.type === 'section') setActive(first.cat.id);
    else if (first?.type === 'pair') setActive(first.catId);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const jumpTo = (catId: string) => {
    const index = sectionAt.get(catId);
    if (index === undefined) return;
    setActive(catId);
    jumpUntil.current = Date.now() + 900;
    // The heading lands just under the pinned bar, not behind it.
    listRef.current?.scrollToIndex({ index, viewOffset: heights.bar, animated: !reduceMotion });
  };

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(r) => r.key}
      contentContainerStyle={styles.menuList}
      showsVerticalScrollIndicator={false}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={9}
      stickyHeaderIndices={searching ? undefined : [1]}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      getItemLayout={getItemLayout}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item: row, index }) => {
        switch (row.type) {
          case 'top':
            return (
              <View style={styles.menuHeader} onLayout={measure('top')}>
                <SearchBar value={query} onChangeText={setQuery} placeholder={t('menu.searchPlaceholder')} />

                {!searching && trending.length > 0 ? (
                  <View style={styles.block}>
                    <Text variant="title" style={styles.blockTitle}>
                      {t('order.trending')}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendRow}>
                      {trending.map((item) => (
                        <Pressable
                          key={item.id}
                          style={styles.trendItem}
                          onPress={() => onSelect(item)}
                          accessibilityRole="button"
                        >
                          <View style={styles.trendThumb}>
                            {item.imageUrl ? (
                              <>
                                <Image source={{ uri: menuImage(item.imageUrl, 200) }} style={styles.trendPhoto} resizeMode="cover" />
                                <PhotoDim />
                              </>
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
              </View>
            );
          case 'bar':
            return (
              <View style={styles.sectionBar} onLayout={measure('bar')}>
                <CategoryChips categories={sections.map((s) => s.cat)} activeId={active} onSelect={jumpTo} />
              </View>
            );
          case 'section':
            return (
              <View style={styles.sectionHead} onLayout={measure('section')}>
                <Text variant="title" numberOfLines={1} accessibilityRole="header">
                  {lang === 'ar' ? row.cat.nameAr : row.cat.nameEn}
                </Text>
              </View>
            );
          case 'empty':
            return (
              <View style={styles.empty} onLayout={measure('empty')}>
                <Icon name="search" size={44} color={colors.warmGray} strokeWidth={1.5} />
                <Text variant="body" color={colors.warmGray}>
                  {t('menu.noResults')}
                </Text>
              </View>
            );
          case 'pair': {
            // Only the first screenful rises in; plain rows below avoid
            // per-cell Animated work while scrolling 375 items.
            const cells = (
              <View style={styles.pairRow} onLayout={measure('pair')}>
                {row.items.map((item) => (
                  <View key={item.id} style={styles.cardWrap}>
                    <MenuItemCard item={item} onPress={() => onSelect(item)} />
                  </View>
                ))}
                {row.items.length === 1 ? <View style={styles.cardWrap} /> : null}
              </View>
            );
            return index < 6 ? <FadeIn delay={index * 30}>{cells}</FadeIn> : cells;
          }
        }
      }}
    />
  );
}

/* --------------------------- Featured sub-tab --------------------------- */

function FeaturedTab({
  items,
  categories,
  onSelect,
}: {
  items: MenuItem[];
  categories: { id: string; nameAr: string; nameEn: string }[];
  onSelect: (i: MenuItem) => void;
}) {
  const { t } = useI18n();

  const seasonalIds = useMemo(
    () => new Set(categories.filter((c) => SEASONAL_KW.test(c.nameEn)).map((c) => c.id)),
    [categories],
  );
  const highlightIds = useMemo(
    () => new Set(categories.filter((c) => HIGHLIGHT_KW.test(c.nameEn)).map((c) => c.id)),
    [categories],
  );
  const seasonal = useMemo(() => items.filter((i) => seasonalIds.has(i.categoryId)).slice(0, 12), [items, seasonalIds]);
  const highlights = useMemo(() => items.filter((i) => highlightIds.has(i.categoryId)).slice(0, 12), [items, highlightIds]);

  return (
    <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
      <View style={styles.block}>
        <Text variant="title" style={styles.blockTitle}>{t('order.featuredTitle')}</Text>
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
          <Text variant="caption" color={colors.warmGray}>{t('order.emptyFeatured')}</Text>
        )}
      </View>

      {highlights.length > 0 ? (
        <View style={styles.block}>
          <Text variant="title" style={styles.blockTitle}>{t('order.brunchTitle')}</Text>
          <Text variant="caption" color={colors.warmGray} style={styles.blockSub}>
            {t('order.brunchSubtitle')}
          </Text>
          <View style={styles.grid}>
            {highlights.map((item) => (
              <View key={item.id} style={styles.gridCell}>
                <MenuItemCard item={item} onPress={() => onSelect(item)} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
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
    router.push('/cart');
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
              leadingIcon="reorder"
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
  // A phone-shaped column, centred, on a tablet or a wide window: the grid,
  // the sub-tabs and the pickup/cart bar stop at a readable width instead of
  // ~700 px cards and full-width segments (audit P2). No change on a phone.
  safe: {
    flex: 1,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    backgroundColor: colors.cream,
  },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subTabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutralWarm,
  },
  subTab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: MIN_TOUCH_TARGET, paddingBottom: spacing.sm },
  subTabsWrapped: { flexWrap: 'wrap' },
  subTabWrapped: { flexBasis: '45%', flexGrow: 1 },
  subTabUnderline: {
    height: 3,
    width: spacing.xl,
    borderRadius: 2,
    marginTop: spacing.sm,
    backgroundColor: 'transparent',
  },
  subTabUnderlineActive: { backgroundColor: colors.primary },

  // Rows space themselves with padding, never margin: a row's measured
  // height must be all the room it takes (getItemLayout in MenuTab).
  menuHeader: { gap: spacing.md, paddingBottom: spacing.sm },
  // The section bar spans the screen while the tiles keep their margin: it
  // pins over the list, so the page's own ground goes under it, edge to edge.
  sectionBar: {
    marginHorizontal: -spacing.lg,
    backgroundColor: colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutralWarm,
  },
  sectionHead: { paddingTop: spacing.xl, paddingBottom: spacing.md },
  pairRow: { flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.md },
  // Extra room at the end so the last row clears the pinned pickup/cart bar.
  menuList: { paddingHorizontal: spacing.lg, paddingTop: LIST_PADDING_TOP, paddingBottom: spacing.xxl * 4 },
  block: { marginTop: spacing.md },
  blockTitle: { marginBottom: spacing.xs },
  blockSub: { marginBottom: spacing.md },

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

  scrollList: { padding: spacing.lg, paddingBottom: spacing.xxl * 4 },
  cardWrap: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridCell: { flexBasis: '45%', flexGrow: 1 },
  skeletonWrap: { padding: spacing.lg, gap: spacing.lg },
  skelChips: { flexDirection: 'row', gap: spacing.sm },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2, gap: spacing.md },
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
