import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { router } from 'expo-router';

import { colors, spacing, radius } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { useAppStore } from '@/stores/appStore';

/**
 * Splash (section 4.1): dark bg, gold coffee-cup logo, animated gold progress
 * bar, 2.5s → Home (or onboarding on first launch).
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
    <View style={styles.container}>
      <Text style={styles.logo}>☕</Text>
      <Text variant="h1" color={colors.lightGold} center style={styles.title}>
        ألموند كوفي هاوس
      </Text>
      <Text variant="caption" color={colors.warmGray} center>
        Almond Coffee House
      </Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logo: { fontSize: 88, marginBottom: spacing.lg },
  title: { marginBottom: spacing.xs },
  barTrack: {
    marginTop: spacing.xxl,
    height: 6,
    width: '60%',
    backgroundColor: colors.brown,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.gold, borderRadius: radius.pill },
});
