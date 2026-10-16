import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { MIN_TOUCH_TARGET } from '@/lib/a11y';
import { logicalSlide, physicalSlide } from '@/lib/campaignSlides';
import { createScrollSettlement } from '@/lib/scrollSettlement';

/** A native manual pager: scrolling owns direct manipulation. No autoplay or
 * custom gesture responder competes with Home's vertical scrolling. WAI-ARIA
 * basic-carousel controls keep focus on Previous/Next; inactive actions are
 * not rendered, and inactive content is hidden on web and native. */
export function CampaignPager({ ids, renderSlide }: {
  ids: readonly string[];
  renderSlide: (logicalIndex: number, active: boolean) => ReactNode;
}) {
  const { t, isRTL } = useI18n();
  const reduced = useReducedMotion();
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const count = ids.length;
  const current = Math.min(index, Math.max(0, count - 1));
  const order = Array.from({ length: count }, (_, i) => physicalSlide(i, count, isRTL));
  const webSettlement = useMemo(() => createScrollSettlement((offset, requested) => {
    // A late scroll/snap observation must not overrule a newer button intent.
    if (requested) scroll.current?.scrollTo({ x: offset, animated: false });
    const next = logicalSlide(offset, width, count, isRTL);
    if (next === indexRef.current) return;
    indexRef.current = next;
    setIndex(next);
  }), [width, count, isRTL]);
  useEffect(() => () => webSettlement.cancel(), [webSettlement]);

  useEffect(() => {
    const valid = Math.min(indexRef.current, Math.max(0, count - 1));
    indexRef.current = valid;
    setIndex(valid);
    scroll.current?.scrollTo({ x: physicalSlide(valid, count, isRTL) * width, animated: false });
  }, [width, count, isRTL]);

  const go = (delta: -1 | 1) => {
    const valid = Math.max(0, Math.min(count - 1, indexRef.current + delta));
    const offset = physicalSlide(valid, count, isRTL) * width;
    if (Platform.OS === 'web') webSettlement.request(offset);
    else webSettlement.cancel();
    indexRef.current = valid;
    setIndex(valid);
    scroll.current?.scrollTo({ x: offset, animated: Platform.OS !== 'web' && !reduced });
  };
  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = logicalSlide(event.nativeEvent.contentOffset.x, width, count, isRTL);
    indexRef.current = next;
    setIndex(next);
  };
  const measure = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));

  if (!count) return null;
  return (
    <View role="region" aria-label={t('campaignSlides.label')} style={styles.root} testID="home-campaign-carousel">
      <View onLayout={measure} style={styles.viewport}>
        {width > 0 ? (
          <ScrollView
            ref={scroll}
            horizontal
            pagingEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={settle}
            onScroll={Platform.OS === 'web' ? (event) => webSettlement.update(event.nativeEvent.contentOffset.x) : undefined}
            onTouchStart={Platform.OS === 'web' ? webSettlement.cancel : undefined}
            {...(Platform.OS === 'web' ? { onWheel: webSettlement.cancel } : {})}
            scrollEventThrottle={32}
            contentOffset={{ x: physicalSlide(current, count, isRTL) * width, y: 0 }}
            style={styles.track}
            contentContainerStyle={styles.row}
            testID="home-campaign-track"
          >
            {order.map((logicalIndex) => {
              const active = logicalIndex === current;
              return (
                <View
                  key={ids[logicalIndex]}
                  style={{ width }}
                  aria-hidden={!active}
                  accessibilityElementsHidden={!active}
                  importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
                  pointerEvents={active ? 'auto' : 'none'}
                  testID={`campaign-slide-${ids[logicalIndex]}`}
                >
                  {renderSlide(logicalIndex, active)}
                </View>
              );
            })}
          </ScrollView>
        ) : null}
      </View>
      <View style={styles.navigation}>
        <Pressable
          onPress={() => go(-1)}
          disabled={current === 0}
          accessibilityRole="button"
          aria-label={t('common.previous')}
          aria-disabled={current === 0}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Icon name={isRTL ? 'chevron-right' : 'chevron-left'} color={current === 0 ? colors.outline : colors.dark} size={22} />
        </Pressable>
        <View style={styles.position}>
          <Text variant="caption" center accessibilityLiveRegion="polite">
            {t('campaignSlides.position', { current: current + 1, total: count })}
          </Text>
          <Text variant="caption" center color={colors.warmGray}>
            {t(isRTL ? 'campaignSlides.swipeRight' : 'campaignSlides.swipeLeft')}
          </Text>
        </View>
        <Pressable
          onPress={() => go(1)}
          disabled={current === count - 1}
          accessibilityRole="button"
          aria-label={t('common.next')}
          aria-disabled={current === count - 1}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Icon name={isRTL ? 'chevron-left' : 'chevron-right'} color={current === count - 1 ? colors.outline : colors.dark} size={22} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: spacing.lg },
  viewport: { overflow: 'hidden' },
  // Explicit LTR track + reversed Arabic data avoids negative RTL offsets.
  track: { direction: 'ltr', flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'stretch', direction: 'ltr' },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  position: { flex: 1, gap: spacing.xs },
  arrow: { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
});
