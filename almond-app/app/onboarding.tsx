import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

/** How far a finger must travel sideways before it turns the page. */
const SWIPE = 48;

/**
 * ONE SLIDE AT A TIME, FROM STATE — not a horizontal FlatList. The list put the
 * slide at the top of the screen under the Skip link, and in Arabic it read
 * its own position backwards: the web build mirrors a horizontal scroller, so
 * the first slide reported itself as the last and the page dots lit the wrong
 * end. The index is now the only truth, the dots read it in the reading
 * direction, and a swipe toward the reading direction's "next" turns the page.
 * Precedent: iOS's own setup assistant — a centred page, a pager, one button.
 */
export default function Onboarding() {
  const { t, lang, isRTL } = useI18n();
  const gift = welcomeBonusOffered();
  const complete = useAppStore((s) => s.completeOnboarding);
  const [index, setIndex] = useState(0);

  const isLast = index === slides.length - 1;
  const slide = slides[index]!;

  const bodyOf = (s: Slide) => {
    if (s.bodyKey !== 'onboarding.slide3Body') return t(s.bodyKey);
    const range = earnRangeCopy(lang);
    return gift > 0
      ? t('onboarding.slide3Body', { low: range.low, high: range.high, gift })
      : t('onboarding.slide3BodyNoGift', { low: range.low, high: range.high });
  };

  const finish = () => {
    complete();
    router.replace('/(auth)/login');
  };
  const goNext = () => (isLast ? finish() : setIndex((i) => Math.min(i + 1, slides.length - 1)));
  const goBack = () => setIndex((i) => Math.max(i - 1, 0));

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) < SWIPE) return;
          // In Arabic the next page is to the left of the reader, so a swipe
          // to the RIGHT brings it in; in English the other way round.
          const forward = isRTL ? g.dx > 0 : g.dx < 0;
          if (forward) setIndex((i) => Math.min(i + 1, slides.length - 1));
          else setIndex((i) => Math.max(i - 1, 0));
        },
      }),
    [isRTL],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        {index > 0 ? (
          <Pressable onPress={goBack} style={styles.topBtn} accessibilityRole="button">
            <Text variant="caption" color={colors.warmGray}>
              {t('common.back')}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.topBtn} />
        )}
        {/* On the last page Skip and the button do the same thing; one is enough. */}
        {isLast ? (
          <View style={styles.topBtn} />
        ) : (
          <Pressable onPress={finish} style={styles.topBtn} accessibilityRole="button">
            <Text variant="caption" color={colors.warmGray}>
              {t('onboarding.skip')}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.slide} {...pan.panHandlers}>
        <View style={styles.iconCircle}>
          <Icon name={slide.icon} size={72} color={colors.dark} strokeWidth={1.5} />
        </View>
        <Text variant="h1" center style={styles.title} accessibilityRole="header">
          {t(slide.titleKey)}
        </Text>
        <Text variant="body" color={colors.warmGray} center style={styles.body}>
          {bodyOf(slide)}
        </Text>
      </View>

      <View style={styles.footer}>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={t('onboarding.page', { n: index + 1, total: slides.length })}
        >
          {slides.map((s, i) => (
            <Pressable
              key={s.titleKey}
              onPress={() => setIndex(i)}
              hitSlop={8}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              <View style={[styles.dot, i === index && styles.dotActive]} />
            </Pressable>
          ))}
        </View>
        <Button title={isLast ? t('onboarding.start') : t('common.next')} onPress={goNext} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  topBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  iconCircle: {
    width: 160, height: 160, borderRadius: 80, borderWidth: 1.5, borderColor: colors.dark,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl,
  },
  title: { marginBottom: spacing.md },
  body: { maxWidth: 360 },
  footer: { padding: spacing.xl, gap: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.outline },
  dotActive: { backgroundColor: colors.dark, width: 22 },
});
