import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '@/constants/theme';

interface Props {
  current: number;
  target: number;
  size?: number;
}

/**
 * The Cup (section 4.9): a visual coffee cup that fills toward the target.
 * Uses a spring fill animation (section 3.3).
 */
export function Cup({ current, target, size = 96 }: Props) {
  const pct = Math.max(0, Math.min(1, current / target));
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fill, {
      toValue: pct,
      friction: 7,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [pct, fill]);

  const height = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View style={[styles.cup, { borderRadius: size * 0.12 }]}>
        <Animated.View style={[styles.fill, { height }]} />
      </View>
      {/* handle */}
      <View style={[styles.handle, { width: size * 0.22, height: size * 0.4 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  cup: {
    flex: 1,
    width: '78%',
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: colors.brown,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: { width: '100%', backgroundColor: colors.gold },
  handle: {
    position: 'absolute',
    end: '4%',
    borderWidth: 3,
    borderColor: colors.brown,
    borderRadius: 999,
    borderStartWidth: 0,
  },
});
