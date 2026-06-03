import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type DimensionValue, type ViewStyle } from 'react-native';
import { colors, radius } from '@/constants/theme';

interface Props {
  width?: DimensionValue;
  height?: number;
  pill?: boolean;
  style?: ViewStyle;
}

/** A shimmering placeholder block (pure Animated — no native deps). */
export function Skeleton({ width = '100%', height = 16, pill, style }: Props) {
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [o]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius: pill ? radius.pill : radius.md, opacity: o },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.neutralWarm },
});
