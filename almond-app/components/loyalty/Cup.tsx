import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Polygon,
  Path,
  Ellipse,
  ClipPath,
  Rect,
} from 'react-native-svg';
import { colors } from '@/constants/theme';

interface Props {
  current: number;
  target: number;
  size?: number;
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// Cup interior (trapezoid) in a 100×100 viewBox.
const TOP_Y = 22;
const BOT_Y = 88;
const INTERIOR = '20,22 80,22 68,88 32,88';

/**
 * The Cup (Revision Pack §C): an attractive coffee cup that fills with a
 * gradient gold "brew" as the user collects drinks. Smooth spring fill, a
 * lighter foam band at the surface, and a warm glow as it nears completion.
 * Target 10 with a 1-drink head-start.
 */
export function Cup({ current, target, size = 96 }: Props) {
  const pct = Math.max(0, Math.min(1, current / target));
  const level = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(level, {
      toValue: pct,
      friction: 6,
      tension: 36,
      useNativeDriver: false,
    }).start();
  }, [pct, level]);

  const liquidY = level.interpolate({
    inputRange: [0, 1],
    outputRange: [BOT_Y, TOP_Y],
  });
  const liquidH = level.interpolate({
    inputRange: [0, 1],
    outputRange: [0, BOT_Y - TOP_Y],
  });
  const foamY = level.interpolate({
    inputRange: [0, 1],
    outputRange: [BOT_Y - 4, TOP_Y],
  });

  const nearFull = pct >= 0.9;

  return (
    <View style={[styles.wrap, { width: size, height: size }, nearFull && styles.glow]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="brew" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.lightGold} />
            <Stop offset="1" stopColor={colors.gold} />
          </LinearGradient>
          <ClipPath id="cupClip">
            <Polygon points={INTERIOR} />
          </ClipPath>
        </Defs>

        {/* empty interior */}
        <Polygon points={INTERIOR} fill={colors.cream} />

        {/* animated liquid (clipped to the cup interior) */}
        <AnimatedRect x={10} y={liquidY} width={80} height={liquidH} fill="url(#brew)" clipPath="url(#cupClip)" />
        {/* foam band at the surface */}
        <AnimatedRect x={10} y={foamY} width={80} height={3} fill={colors.lightGold} clipPath="url(#cupClip)" opacity={0.9} />

        {/* cup outline */}
        <Polygon
          points={INTERIOR}
          fill="none"
          stroke={colors.brown}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        {/* rim */}
        <Ellipse cx={50} cy={22} rx={30} ry={5} fill="none" stroke={colors.brown} strokeWidth={4} />
        {/* handle */}
        <Path
          d="M80 34 q16 4 12 20 q-3 12 -16 12"
          fill="none"
          stroke={colors.brown}
          strokeWidth={4}
          strokeLinecap="round"
        />
        {/* saucer */}
        <Path d="M26 92 h48" stroke={colors.brown} strokeWidth={4} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 8,
  },
});
