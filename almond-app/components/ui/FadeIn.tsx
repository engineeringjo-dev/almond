import { ReactNode, useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { timing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Subtle fade + rise entrance (300ms ease, section 3.3). Under Reduce Motion
 * the content is simply there — nothing rises into place.
 */
export function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduced ? 0 : 8)).current;

  useEffect(() => {
    if (reduced) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    const entrance = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: timing.base, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: timing.base, delay, useNativeDriver: true }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [opacity, translateY, delay, reduced]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
