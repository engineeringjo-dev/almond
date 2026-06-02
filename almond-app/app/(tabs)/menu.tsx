import { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { SearchBar } from '@/components/ui/SearchBar';
import { CategoryChips } from '@/components/menu/CategoryChips';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { ItemModal } from '@/components/menu/ItemModal';
import { Logo } from '@/components/ui/Logo';
import { FadeIn } from '@/components/ui/FadeIn';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useCategories, useMenuItems } from '@/hooks/useMenu';
import { Screen } from '@/components/ui/Screen';
import type { MenuItem } from '@/types';

export default function MenuScreen() {
  const { t } = useI18n();
  const [activeCat, setActiveCat] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const categoriesQuery = useCategories();
  const itemsQuery = useMenuItems('all');

  const displayed = useMemo(() => {
    const items: MenuItem[] = itemsQuery.data ?? [];
    const q = query.trim().toLowerCase();
    if (q) {
      return items.filter(
        (i: MenuItem) =>
          i.nameAr.toLowerCase().includes(q) ||
          i.nameEn.toLowerCase().includes(q) ||
          (i.descEn ?? '').toLowerCase().includes(q),
      );
    }
    if (activeCat === 'all') return items;
    return items.filter((i: MenuItem) => i.categoryId === activeCat);
  }, [itemsQuery.data, query, activeCat]);

  const loading = categoriesQuery.isLoading || itemsQuery.isLoading;
  const error = categoriesQuery.isError || itemsQuery.isError;

  if (loading || error) {
    return <Screen loading={loading} error={error} onRetry={itemsQuery.refetch} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Logo variant="badge" tone="dark" size={28} />
          <Text variant="h1" style={styles.title}>
            {t('menu.title')}
          </Text>
        </View>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t('menu.searchPlaceholder')} />
      </View>

      {!query ? (
        <View style={styles.chips}>
          <CategoryChips
            categories={categoriesQuery.data ?? []}
            activeId={activeCat}
            onSelect={setActiveCat}
          />
        </View>
      ) : null}

      <FlatList
        data={displayed}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <FadeIn delay={Math.min(index, 8) * 30} style={styles.cardWrap}>
            <MenuItemCard item={item} onPress={() => setSelectedItem(item)} />
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

      <ItemModal
        item={selectedItem}
        visible={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: {},
  chips: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  column: { gap: spacing.md },
  cardWrap: { flex: 1 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2, gap: spacing.md },
  emptyEmoji: { fontSize: 44 },
});
