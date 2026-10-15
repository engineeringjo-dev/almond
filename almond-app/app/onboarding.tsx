import { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  FlatList,
  Pressable,
  ViewToken,
} from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useAppStore } from '@/stores/appStore';
import { earnRangeCopy, welcomeBonusOffered } from '@almond/shared/loyalty';

interface Slide {
  icon: IconName;
  titleKey: string;
  bodyKey: string;
}

/**
 * Three slides, each a promise the app keeps. Owner, 2026-10-15: «ازل الخطأ
 * بالجملة الترحيبية». The third slide used to say «مكافآت وأكواب مجانية وعجلة
 * الحظ» — free cups and a lucky wheel, neither of which exists — and the second
 * «طلبك جاهز عند وصولك تماماً», which no café can promise. The third now states
 * the programme from the dials (earnRangeCopy) and the welcome gift from its
 * own (welcomeBonusOffered); a programme with no gift says nothing about one.
 * Line icons, not emoji: the identity is black and white (owner, same day).
 */
const slides: Slide[] = [
  { icon: 'coffee', titleKey: 'onboarding.slide1Title', bodyKey: 'onboarding.slide1Body' },
  { icon: 'clock', titleKey: 'onboarding.slide2Title', bodyKey: 'onboarding.slide2Body' },
  { icon: 'coins', titleKey: 'onboarding.slide3Title', bodyKey: 'onboarding.slide3Body' },
];

export default function Onboarding() {
  const { t, lang } = useI18n();
  const gift = welcomeBonusOffered();
  const bodyOf = (s: Slide) => {
    if (s.bodyKey !== 'onboarding.slide3Body') return t(s.bodyKey);
    const range = earnRangeCopy(lang);
    return gift > 0
      ? t('onboarding.slide3Body', { low: range.low, high: range.high, gift })
      : t('onboarding.slide3BodyNoGift', { low: range.low, high: range.high });
  };
  const { width } = useWindowDimensions();
  const complete = useAppStore((s) => s.completeOnboarding);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const isLast = index === slides.length - 1;

  const finish = () => {
    complete();
    router.replace('/(auth)/login');
  };

  const goNext = () => {
    if (isLast) finish();
    else listRef.current?.scrollToIndex({ index: index + 1 });
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.skip} onPress={finish} hitSlop={12}>
        <Text variant="caption" color={colors.warmGray}>
          {t('onboarding.skip')}
        </Text>
      </Pressable>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(s) => s.titleKey}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.iconCircle}>
              <Icon name={item.icon} size={72} color={colors.dark} strokeWidth={1.5} />
            </View>
            <Text variant="h1" center style={styles.title}>
              {t(item.titleKey)}
            </Text>
            <Text variant="body" color={colors.warmGray} center>
              {bodyOf(item)}
            </Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <View key={s.titleKey} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button title={isLast ? t('onboarding.start') : t('common.next')} onPress={goNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  skip: { position: 'absolute', top: 60, end: spacing.lg, zIndex: 10, padding: spacing.sm },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  iconCircle: {
    width: 160, height: 160, borderRadius: 80, borderWidth: 1.5, borderColor: colors.dark,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl,
  },
  title: { marginBottom: spacing.md },
  footer: { padding: spacing.xl, gap: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warmGray, opacity: 0.4 },
  dotActive: { backgroundColor: colors.gold, opacity: 1, width: 22 },
});
