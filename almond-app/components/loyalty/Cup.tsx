import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  ClipPath,
  Path,
  Rect,
  G,
  Ellipse,
} from 'react-native-svg';
import { colors } from '@/constants/theme';

interface Props {
  current: number;
  target: number;
  size?: number;
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// Line-art paper coffee cup (Flaticon style): black outline cup + lid with a
// three-bean coffee logo on the body. The body fills with coffee from the
// bottom up as the user collects drinks toward the target (10 drinks).
//
// Geometry is authored in a 100×100 viewBox. The body is a tapered trapezoid:
//   top edge  y = 30  (x 27 → 73)
//   bottom    y = 88  (x 35 → 65)
const STROKE = '#1A0F08';
const SW = 3; // outline stroke width

// Body outline path (rounded bottom corners) used both for the visible cup and
// as the clip region for the rising coffee.
const BODY_PATH =
  'M27 30 L73 30 L66 84 Q65 88 61 88 L39 88 Q35 88 34 84 Z';

// Body interior is filled between y=30 (top, empty) and y=88 (bottom, full-ish).
const FILL_TOP = 31;
const FILL_BOTTOM = 87;
const FILL_RANGE = FILL_BOTTOM - FILL_TOP;

export function Cup({ current, target, size = 96 }: Props) {
  const pct = Math.max(0, Math.min(1, current / target));
  const level = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(level, {
      toValue: pct,
      friction: 7,
      tension: 36,
      useNativeDriver: false,
    }).start();
  }, [pct, level]);

  // Coffee surface rises from FILL_BOTTOM (empty) up to FILL_TOP (full).
  const fillY = level.interpolate({ inputRange: [0, 1], outputRange: [FILL_BOTTOM, FILL_TOP] });
  const fillH = level.interpolate({ inputRange: [0, 1], outputRange: [0, FILL_RANGE] });
  const surfaceOpacity = level.interpolate({ inputRange: [0, 0.04, 1], outputRange: [0, 1, 1] });

  const nearFull = pct >= 0.9;

  return (
    <View style={[styles.wrap, { width: size, height: size }, nearFull && styles.glow]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="coffee" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7A553A" />
            <Stop offset="1" stopColor="#3D2616" />
          </LinearGradient>
          <ClipPath id="bodyClip">
            <Path d={BODY_PATH} />
          </ClipPath>
        </Defs>

        {/* White cup body so the coffee + logo read cleanly */}
        <Path d={BODY_PATH} fill={colors.white} />

        {/* Rising coffee, clipped to the body shape */}
        <G clipPath="url(#bodyClip)">
          <AnimatedRect x={20} y={fillY} width={60} height={fillH} fill="url(#coffee)" />
          {/* Coffee surface highlight at the waterline */}
          <AnimatedEllipse
            cx={50}
            cy={fillY}
            rx={24}
            ry={2.4}
            fill="#9C7853"
            opacity={surfaceOpacity}
          />
        </G>

        {/* Three-bean coffee logo on the cup body (covered as coffee rises) */}
        <G>
          <CoffeeBean cx={42} cy={52} rot={-18} />
          <CoffeeBean cx={58} cy={52} rot={18} />
          <CoffeeBean cx={50} cy={64} rot={0} />
        </G>

        {/* Body outline (drawn last so it stays crisp over the fill) */}
        <Path d={BODY_PATH} fill="none" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />

        {/* Lid: a band + slight dome, sitting a touch wider than the cup top */}
        <Rect x={22} y={20} width={56} height={11} rx={3.5} fill={colors.white} stroke={STROKE} strokeWidth={SW} />
        <Path
          d="M27 20 Q27 13 34 13 L66 13 Q73 13 73 20 Z"
          fill={colors.white}
          stroke={STROKE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

// A single coffee bean: an oval with a curved seam down the middle.
function CoffeeBean({ cx, cy, rot }: { cx: number; cy: number; rot: number }) {
  return (
    <G origin={`${cx}, ${cy}`} rotation={rot}>
      <Ellipse cx={cx} cy={cy} rx={5.4} ry={3.4} fill="none" stroke={STROKE} strokeWidth={2} />
      <Path
        d={`M${cx} ${cy - 3} Q${cx + 2.4} ${cy} ${cx} ${cy + 3}`}
        fill="none"
        stroke={STROKE}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </G>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
});
