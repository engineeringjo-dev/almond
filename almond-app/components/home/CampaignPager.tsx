import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useIsFocused } from 'expo-router';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { MIN_TOUCH_TARGET } from '@/lib/a11y';
import { CAMPAIGN_GAP, campaignGeometry, campaignOffset, campaignPages, createCampaignVisitPicker, settledCampaign, wrapCampaign } from '@/lib/campaignPager';
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
  const focused = useIsFocused();
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const [pickVisit] = useState(() => createCampaignVisitPicker());
  const count = ids.length;
  const current = Math.min(index, Math.max(0, count - 1));
  const { card, inset, step } = campaignGeometry(width);
  const pages = campaignPages(count, isRTL);
  const webSettlement = useMemo(() => createScrollSettlement((offset, requested) => {
    const settled = settledCampaign(offset, step, count, isRTL);
    // Rebase an end copy to its identical original. A late observation must
    // also never overrule the latest rapid-button destination.
    if (requested || settled.clone) scroll.current?.scrollTo({ x: settled.offset, animated: false });
    if (settled.logical === indexRef.current) return;
    indexRef.current = settled.logical;
    setIndex(settled.logical);
  }), [step, count, isRTL]);
  useEffect(() => () => webSettlement.cancel(), [webSettlement]);

  useEffect(() => {
    const valid = pickVisit(focused, count) ?? Math.min(indexRef.current, Math.max(0, count - 1));
    webSettlement.cancel();
    indexRef.current = valid;
    setIndex(valid);
    scroll.current?.scrollTo({ x: campaignOffset(valid, step, count, isRTL), animated: false });
  }, [focused, step, count, isRTL, pickVisit, webSettlement]);

  const go = (delta: -1 | 1) => {
    const valid = wrapCampaign(indexRef.current + delta, count);
    const offset = campaignOffset(valid, step, count, isRTL);
    if (Platform.OS === 'web') webSettlement.request(offset);
    else webSettlement.cancel();
    indexRef.current = valid;
    setIndex(valid);
    // Buttons are instantaneous on both platforms, including circular jumps.
    // Direct finger scrolling keeps the platform's own movement and snap.
    scroll.current?.scrollTo({ x: offset, animated: false });
  };
  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const settled = settledCampaign(event.nativeEvent.contentOffset.x, step, count, isRTL);
    if (settled.clone) scroll.current?.scrollTo({ x: settled.offset, animated: false });
    indexRef.current = settled.logical;
    setIndex(settled.logical);
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
            snapToInterval={step}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={settle}
            onScroll={Platform.OS === 'web' ? (event) => webSettlement.update(event.nativeEvent.contentOffset.x) : undefined}
            onTouchStart={Platform.OS === 'web' ? webSettlement.cancel : undefined}
            {...(Platform.OS === 'web' ? { onWheel: webSettlement.cancel } : {})}
            scrollEventThrottle={32}
            contentOffset={{ x: campaignOffset(current, step, count, isRTL), y: 0 }}
            style={styles.track}
            contentContainerStyle={[styles.row, { paddingHorizontal: inset }]}
            testID="home-campaign-track"
          >
            {pages.map(({ slot, logical, clone }) => {
              const active = !clone && logical === current;
              return (
                <View
                  key={`${ids[logical]}-${slot}`}
                  style={[{ width: card }, Platform.OS === 'web' && styles.webPage]}
                  aria-hidden={!active}
                  accessibilityElementsHidden={!active}
                  importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
                  pointerEvents={active ? 'auto' : 'none'}
                  testID={clone ? `campaign-clone-${slot}` : `campaign-slide-${ids[logical]}`}
                >
                  {renderSlide(logical, active)}
                </View>
              );
            })}
          </ScrollView>
        ) : null}
      </View>
      <View style={styles.navigation}>
        <Pressable
          onPress={() => go(-1)}
          disabled={count < 2}
          accessibilityRole="button"
          aria-label={t('common.previous')}
          aria-disabled={count < 2}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Icon name={isRTL ? 'chevron-right' : 'chevron-left'} color={colors.dark} size={22} />
        </Pressable>
        <View style={styles.position}>
          <Text variant="caption" center accessibilityLiveRegion="polite" testID="home-campaign-position">
            {t('campaignSlides.position', { current: current + 1, total: count })}
          </Text>
          <Text variant="caption" center color={colors.warmGray}>
            {t(isRTL ? 'campaignSlides.swipeRight' : 'campaignSlides.swipeLeft')}
          </Text>
        </View>
        <Pressable
          onPress={() => go(1)}
          disabled={count < 2}
          accessibilityRole="button"
          aria-label={t('common.next')}
          aria-disabled={count < 2}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Icon name={isRTL ? 'chevron-left' : 'chevron-right'} color={colors.dark} size={22} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: spacing.lg },
  viewport: { overflow: 'hidden' },
  // Explicit LTR track + reversed Arabic data avoids negative RTL offsets.
  track: { direction: 'ltr', flexGrow: 0, ...Platform.select({ web: { scrollSnapType: 'x mandatory' } }) },
  webPage: { scrollSnapAlign: 'center' } as object,
  row: { flexDirection: 'row', alignItems: 'stretch', direction: 'ltr', gap: CAMPAIGN_GAP },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  position: { flex: 1, gap: spacing.xs },
  arrow: { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
});
