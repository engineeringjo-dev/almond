import { ReactNode, useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { timing } from '@/constants/theme';

/** Subtle fade + rise entrance (300ms ease, section 3.3). */
export function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: timing.base, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: timing.base, delay, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, delay]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
