import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  PanResponder,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { tabA11y } from '@/lib/a11y';
import { carouselStep, settleIndex } from '@/lib/carousel';

export interface SlideContext {
  /** The slide's width, in points. */
  width: number;
  /** Keyboard focus on the web brings the slide into view. */
  onFocus: () => void;
  /** Wrap a slide's onPress: a tap that ends a swipe is not a press. */
  press: (fn: () => void) => () => void;
}

interface Props {
  count: number;
  renderSlide: (index: number, ctx: SlideContext) => ReactElement;
  /** The carousel's name for a screen reader: «العروض». */
  label: string;
  /** A dot's name: «العرض 2 من 5». */
  pickLabel: (n: number, total: number) => string;
  /** How much of each neighbour shows, in points. */
  peek?: number;
  gap?: number;
  /** The horizontal padding of the screen around the carousel: the carousel
   *  runs past it to the window's edges, so the neighbours peek from there. */
  bleed?: number;
  /** A wide window does not get a slide wider than this. */
  maxSlideWidth?: number;
  /** Previous and next buttons beside the dots. */
  arrows?: boolean;
  onIndexChange?: (index: number) => void;
}

/**
 * THE CAROUSEL WITH THE NEIGHBOURS SHOWING — Al Ameed's top bar, which the
 * owner asked for by name (2026-10-15: «قابلة للاستكشاف مثل البار العلوي
 * بالعميد»): one slide in the middle, the edges of the next and previous slides
 * at the sides, and a row of dots under it. The edges are what make it
 * explorable; a reader who sees a second card half in view knows to swipe.
 *
 * ONE SLIDE AT A TIME, FROM STATE, like the onboarding pager, and not a
 * horizontal ScrollView. A scroller reports its offset differently in each
 * direction and on each platform. The web reports a negative offset in
 * right-to-left text, so the rewards tier carousel, which divided that offset
 * by the card width, worked out a page of -1 in Arabic, and its arrows
 * scrolled to an offset the browser clamps to 0. Here the index is the only
 * truth:
 * - the row is moved to it;
 * - a swipe toward the reading direction's "next" advances it;
 * - the dots show it in the reading direction.
 *
 * Accessible (WAI-ARIA Authoring Practices, Carousel):
 * - The carousel is a named region.
 * - The dots are a tablist; each names its slide («العرض 2 من 5») and says
 *   whether it is the one showing, and is at least 24 points (WCAG 2.5.8).
 * - There are optional previous and next buttons.
 * - A slide that takes keyboard focus scrolls into view.
 * - Nothing moves by itself. An auto-advancing carousel is the pattern NN/g
 *   found people ignore, and WCAG 2.2.2 would require a pause button for it.
 * - Under Reduce Motion the row jumps instead of sliding.
 */
export function PeekCarousel({
  count,
  renderSlide,
  label,
  pickLabel,
  peek = 20,
  gap = spacing.md,
  bleed = 0,
  maxSlideWidth = 460,
  arrows = false,
  onIndexChange,
}: Props) {
  const { t, isRTL } = useI18n();
  const reduced = useReducedMotion();
  const screen = useWindowDimensions();
  const [width, setWidth] = useState(screen.width);
  const [index, setIndex] = useState(0);

  const slideWidth = Math.max(0, Math.min(width - 2 * (peek + gap), maxSlideWidth));
  const inset = (width - slideWidth) / 2;
  const step = slideWidth + gap;
  // In Arabic the next slide waits to the LEFT, so the row moves right to
  // bring it in; transforms are not mirrored, so the sign is.
  const sign = isRTL ? 1 : -1;

  const pos = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(0);
  const draggedAt = useRef(0);
  const translateX = useMemo(() => Animated.add(pos, drag), [pos, drag]);

  const last = Math.max(0, count - 1);
  const go = (i: number) => setIndex(Math.max(0, Math.min(last, i)));

  // A shorter list (the menu changed) must not leave the index past the end.
  useEffect(() => {
    if (index > last) setIndex(last);
  }, [index, last]);

  useEffect(() => {
    indexRef.current = index;
    onIndexChange?.(index);
    const to = carouselStep(index, step, sign);
    if (reduced) {
      pos.setValue(to);
      return;
    }
    Animated.timing(pos, {
      toValue: to,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    // `onIndexChange` is the caller's, and is not a reason to move the row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, step, sign, reduced, pos]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Capture a sideways drag even when it starts on a slide's button, so a
        // swipe is a swipe and not a press; leave an up-and-down drag to the
        // screen's own scrolling.
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) => {
          // At either end the row gives a little and then holds.
          const i = indexRef.current;
          const forward = sign < 0 ? g.dx < 0 : g.dx > 0;
          const pastEnd = (forward && i === last) || (!forward && i === 0);
          drag.setValue(pastEnd ? g.dx * 0.3 : g.dx);
        },
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) > 10) draggedAt.current = Date.now();
          drag.setValue(0);
          go(settleIndex({ index: indexRef.current, dx: g.dx, vx: g.vx, slideWidth, rtl: sign > 0, last }));
        },
        onPanResponderTerminate: () => drag.setValue(0),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sign, last, slideWidth],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };

  const ctxFor = (i: number): SlideContext => ({
    width: slideWidth,
    onFocus: () => go(i),
    press: (fn) => () => {
      if (Date.now() - draggedAt.current < 350) return;
      fn();
    },
  });

  if (count === 0) return null;

  return (
    <View role="region" aria-label={label}>
      <View style={[styles.viewport, { marginHorizontal: -bleed }]} onLayout={onLayout}>
        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.row,
            webSwipeOnly,
            { paddingHorizontal: inset, gap, transform: [{ translateX }] },
          ]}
        >
          {Array.from({ length: count }, (_, i) => (
            <View key={i} style={{ width: slideWidth }}>
              {renderSlide(i, ctxFor(i))}
            </View>
          ))}
        </Animated.View>
      </View>

      {count > 1 ? (
        <View style={styles.nav}>
          {arrows ? (
            <Arrow
              icon={isRTL ? 'chevron-right' : 'chevron-left'}
              label={t('common.previous')}
              disabled={index === 0}
              onPress={() => go(index - 1)}
            />
          ) : null}
          {/* A tablist, so each dot says which slide it is and whether it is the
              one showing (WAI-ARIA APG, carousel with tabs for slide control),
              and the arrow keys move along it (lib/spaceKey.ts). */}
          <View style={styles.dots} role="tablist" aria-label={label}>
            {Array.from({ length: count }, (_, i) => (
              <Pressable
                key={i}
                onPress={() => go(i)}
                style={styles.dotTarget}
                {...tabA11y(i === index, pickLabel(i + 1, count))}
              >
                <View style={[styles.dot, i === index && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
          {arrows ? (
            <Arrow
              icon={isRTL ? 'chevron-left' : 'chevron-right'}
              label={t('common.next')}
              disabled={index === last}
              onPress={() => go(index + 1)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Arrow({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevron-left' | 'chevron-right';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={styles.arrow}
      accessibilityRole="button"
      aria-label={label}
      aria-disabled={disabled}
    >
      <Icon name={icon} size={22} color={disabled ? colors.outline : colors.dark} strokeWidth={2} />
    </Pressable>
  );
}

/**
 * The web only: the browser keeps vertical panning, so the page still
 * scrolls, and leaves a sideways drag to the carousel. A mouse drag does not
 * select the slide's text.
 */
const webSwipeOnly = Platform.OS === 'web' ? ({ touchAction: 'pan-y', userSelect: 'none' } as object) : null;

const styles = StyleSheet.create({
  viewport: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dots: { flexDirection: 'row', alignItems: 'center' },
  dotTarget: { minWidth: 24, minHeight: 24, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.outline },
  dotActive: { width: 22, backgroundColor: colors.dark },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
