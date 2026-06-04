import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image } from 'react-native';
import { colors } from '@/constants/theme';

interface Props {
  current: number;
  target: number;
  size?: number;
}

// Real Almond americano cup photo. Shown faded (empty) and revealed bottom-up
// as the loyalty cup fills toward the target (10 drinks).
const CUP = require('../../assets/menu/americano-hot.jpg');

/**
 * Loyalty progress "cup": the real americano cup photo that fills with coffee
 * from the bottom up as the user collects drinks. The faded base is the empty
 * cup; a full-colour copy is revealed up to the current fill level.
 */
export function Cup({ current, target, size = 96 }: Props) {
  const pct = Math.max(0, Math.min(1, current / target));
  const level = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(level, { toValue: pct, friction: 7, tension: 36, useNativeDriver: false }).start();
  }, [pct, level]);

  const fillH = level.interpolate({ inputRange: [0, 1], outputRange: [0, size] });
  const nearFull = pct >= 0.9;

  return (
    <View style={[styles.wrap, { width: size, height: size }, nearFull && styles.glow]}>
      {/* faded empty cup */}
      <Image source={CUP} style={[styles.img, styles.faded, { width: size, height: size }]} resizeMode="contain" />
      {/* coffee fill revealed bottom-up */}
      <Animated.View style={[styles.fillClip, { height: fillH }]}>
        <Image source={CUP} style={[styles.img, { width: size, height: size }]} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { position: 'absolute', bottom: 0, left: 0 },
  faded: { opacity: 0.22 },
  fillClip: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  glow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
});
