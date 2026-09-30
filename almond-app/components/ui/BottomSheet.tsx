import { ReactNode, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, radius, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { MIN_TOUCH_TARGET } from '@/lib/a11y';
import { dragOffset, shouldDismissSheet } from '@/lib/sheetGesture';
import { Icon } from './Icon';
import { Text } from './Text';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /**
   * The dialog's accessible name when there is no visible `title` (the item
   * sheet names itself after the item). Without either, a screen reader hears
   * an unnamed "dialog" (axe aria-dialog-name, audit).
   */
  label?: string;
  children: ReactNode;
  /** Footer stays pinned below the scrollable content (e.g. an Add button). */
  footer?: ReactNode;
}

/**
 * A modal sheet for a self-contained task (HIG / Material bottom sheet).
 *
 * - Named dialog: `title`, else `label`.
 * - A visible close control (44 pt / 48 dp) — Escape (web) and Android Back already
 *   closed it, but a touch user on iOS had only the backdrop.
 * - The grabber works: drag the header down to dismiss (a quick flick is
 *   enough; a short drag springs back). Upward drag is damped, not blocked.
 * - On a tablet or a wide window the sheet stops at `layout.sheetMaxWidth`,
 *   centred, instead of a 1,400 px button.
 * - Reduce Motion: no spring slide — the backdrop's fade carries it.
 */
export function BottomSheet({ visible, onClose, title, label, children, footer }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const translate = useRef(new Animated.Value(reduced ? 0 : height)).current;
  // The latest onClose/height for the gesture handlers, created once.
  const latest = useRef({ onClose, height, reduced });
  latest.current = { onClose, height, reduced };

  useEffect(() => {
    if (reduced) {
      translate.setValue(visible ? 0 : height);
      return;
    }
    Animated.spring(translate, {
      toValue: visible ? 0 : height,
      useNativeDriver: true,
      friction: 11,
      tension: 70,
    }).start();
  }, [visible, height, translate, reduced]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        // Claim only a mostly-vertical drag, so taps on the close button and
        // horizontal scrolls inside the header still work.
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => translate.setValue(dragOffset(g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (shouldDismissSheet(g.dy, g.vy)) {
            latest.current.onClose();
            return;
          }
          Animated.spring(translate, { toValue: 0, useNativeDriver: true, friction: 11, tension: 70 }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translate, { toValue: 0, useNativeDriver: true, friction: 11, tension: 70 }).start();
        },
      }),
    [translate],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      aria-label={title ?? label}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        // The backdrop is a pointer shortcut; the close button is the control.
        focusable={false}
        aria-hidden
      />
      <View style={styles.dock} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            { maxHeight: height * 0.9, transform: [{ translateY: translate }] },
          ]}
        >
          <View {...pan.panHandlers} style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.titleRow}>
              {title ? (
                <Text variant="h2" style={styles.title} role="heading" aria-level={2}>
                  {title}
                </Text>
              ) : (
                <View style={styles.title} />
              )}
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Icon name="close" size={20} color={colors.dark} strokeWidth={2.2} />
              </Pressable>
            </View>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
              {footer}
            </View>
          ) : (
            <View style={{ height: insets.bottom }} />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(46,37,82,0.5)' },
  // Full-width dock at the bottom; the sheet inside is centred and capped.
  dock: { position: 'absolute', start: 0, end: 0, bottom: 0, alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: layout.sheetMaxWidth,
    backgroundColor: colors.cream,
    borderTopStartRadius: radius.xl,
    borderTopEndRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  header: { marginBottom: spacing.xs },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.warmGray,
    opacity: 0.4,
    marginBottom: spacing.xs,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: MIN_TOUCH_TARGET },
  title: { flex: 1 },
  close: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutralWarm,
  },
  closePressed: { opacity: 0.7 },
  content: { paddingBottom: spacing.lg },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutralWarm,
  },
});
