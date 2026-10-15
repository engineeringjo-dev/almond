import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { router } from 'expo-router';

import { colors, spacing, radius } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Logo } from '@/components/ui/Logo';
import { useI18n } from '@/hooks/useI18n';
import { useAppStore } from '@/stores/appStore';

/**
 * Splash (app open): the wordmark on the plain page — black on white, white on
 * black in dark mode — and an ink progress bar, 2.5s → Home (or onboarding on
 * first launch). It was the pastel rainbow gradient; the identity is the
 * logo's black and white now (owner, 2026-10-15).
 */
export default function Splash() {
  const progress = useRef(new Animated.Value(0)).current;
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const { t, lang } = useI18n();

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 2500,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();

    const timer = setTimeout(() => {
      router.replace(hasOnboarded ? '/(tabs)' : '/onboarding');
    }, 2500);
    return () => clearTimeout(timer);
  }, [hasOnboarded, progress]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.container}>
      <Logo variant="wordmark" size={260} style={styles.logo} />
      {/* The wordmark is Latin; the Arabic reader also gets the name in Arabic. */}
      {lang === 'ar' ? (
        <Text variant="caption" color={colors.warmGray} center>
          {t('common.appName')}
        </Text>
      ) : null}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logo: { marginBottom: spacing.md },
  barTrack: {
    marginTop: spacing.xxl,
    height: 6,
    width: '60%',
    backgroundColor: colors.neutralWarm,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.dark, borderRadius: radius.pill },
});
