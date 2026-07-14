import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';
import { Icon } from './Icon';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { iconForItem } from '@/lib/productIcon';
import { useToastStore } from '@/stores/toastStore';

/**
 * "Added to cart" toast with the item's icon (Spec §4.2). Mounted once at the
 * root; auto-hides; tapping opens the cart.
 */
export function CartToast() {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { visible, kind, itemId, nameAr, nameEn, message, seq, hide } = useToastStore();
  const y = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const isError = kind === 'error';

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 9 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(y, { toValue: 80, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => hide());
    }, isError ? 3200 : 1800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, visible]);

  if (!visible) return null;

  // Error variant: red toast that just dismisses on tap (no cart navigation).
  if (isError) {
    return (
      <Animated.View
        pointerEvents="box-none"
        style={[styles.wrap, { bottom: Math.max(insets.bottom, 16) + 88, opacity, transform: [{ translateY: y }] }]}
      >
        <Pressable style={[styles.toast, styles.toastError]} onPress={hide}>
          <View style={[styles.thumb, styles.thumbError]}>
            <Icon name="close" size={20} color={colors.white} strokeWidth={2.2} />
          </View>
          <View style={styles.body}>
            <Text variant="bodyBold" color={colors.white} numberOfLines={2}>
              {message}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 16) + 88, opacity, transform: [{ translateY: y }] }]}
    >
      <Pressable style={styles.toast} onPress={() => { hide(); router.push('/(tabs)/cart'); }}>
        <View style={styles.thumb}>
          <Icon name={iconForItem(itemId)} size={22} color={colors.white} strokeWidth={1.8} />
        </View>
        <View style={styles.body}>
          <Text variant="bodyBold" color={colors.cream} numberOfLines={1}>
            {lang === 'ar' ? nameAr : nameEn}
          </Text>
          <Text variant="caption" color={colors.lightGold}>
            {t('menu.added')}
          </Text>
        </View>
        <Icon name="cart" size={20} color={colors.cream} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: spacing.lg, end: spacing.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
    backgroundColor: colors.dark,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadow.raised,
  },
  toastError: { backgroundColor: colors.red },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbError: { backgroundColor: 'rgba(255,255,255,0.22)' },
  body: { flex: 1, gap: 2 },
});
