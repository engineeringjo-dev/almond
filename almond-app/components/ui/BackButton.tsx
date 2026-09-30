import { Pressable, StyleSheet } from 'react-native';
import { router, type Href } from 'expo-router';

import { Icon } from './Icon';
import { colors, radius } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';

/**
 * «رجوع» for a stack screen that draws its own header. Goes back when there is
 * somewhere to go back to; a cold deep link (nothing behind it) lands on
 * `fallback` instead of a dead end. The chevron points to the reading start —
 * right in Arabic, left in English. 44×44, sized rather than hitSlop'd, since
 * react-native-web ignores hitSlop.
 */
export function BackButton({ fallback }: { fallback: Href }) {
  const { t, isRTL } = useI18n();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
    >
      <Icon name={isRTL ? 'chevron-right' : 'chevron-left'} size={24} color={colors.dark} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
