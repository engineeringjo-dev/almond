import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { router } from 'expo-router';

import { colors, spacing, radius } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Gradient } from '@/components/ui/Gradient';
import { Logo } from '@/components/ui/Logo';
import { useAppStore } from '@/stores/appStore';

/**
 * Splash (app open): pastel rainbow gradient (same as the points hero), gold
 * progress bar, 2.5s → Home (or onboarding on first launch). Dark text/logo for
 * contrast on the light gradient.
 */
export default function Splash() {
  const progress = useRef(new Animated.Value(0)).current;
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);

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
    <Gradient preset="rainbow" style={styles.container}>
      <Logo variant="wordmark" tone="dark" size={260} style={styles.logo} />
      <Text variant="caption" color={colors.brown} center>
        ألموند كوفي هاوس
      </Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width }]} />
      </View>
    </Gradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logo: { marginBottom: spacing.md },
  barTrack: {
    marginTop: spacing.xxl,
    height: 6,
    width: '60%',
    backgroundColor: 'rgba(46,37,82,0.18)',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.dark, borderRadius: radius.pill },
});
