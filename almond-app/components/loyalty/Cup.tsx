import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  ClipPath,
  Path,
  Rect,
  Line,
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

// Line-art paper coffee cup (matches the supplied Flaticon reference): flared
// lid lip + band, a collar, a tapered ribbed body carrying a two-bean coffee
// logo, and a flared base. Authored in a 120×150 viewBox (≈ the reference's
// 0.8 aspect). The body fills with coffee from the bottom up as the user
// collects drinks toward the target (10).
const STROKE = '#1A0F08';
const SW = 3.4; // outline stroke width

// Tapered body — used for the visible cup AND as the coffee clip region.
const BODY_PATH =
  'M24 57 L96 57 L85 127 Q84 130 80 130 L40 130 Q36 130 35 127 Z';

// Coffee surface travels between these Y values (empty → full).
const FILL_BOTTOM = 127;
const FILL_TOP = 59;
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

  const fillY = level.interpolate({ inputRange: [0, 1], outputRange: [FILL_BOTTOM, FILL_TOP] });
  const fillH = level.interpolate({ inputRange: [0, 1], outputRange: [0, FILL_RANGE] });
  const surfaceOpacity = level.interpolate({ inputRange: [0, 0.04, 1], outputRange: [0, 1, 1] });

  const nearFull = pct >= 0.9;
  // Keep the cup's natural 0.8 aspect inside the square slot it's given.
  const w = size * 0.8;
  const h = size;

  return (
    <View style={[styles.wrap, { width: w, height: h }, nearFull && styles.glow]}>
      <Svg width={w} height={h} viewBox="0 0 120 150">
        <Defs>
          <LinearGradient id="coffee" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7A553A" />
            <Stop offset="1" stopColor="#3D2616" />
          </LinearGradient>
          <ClipPath id="bodyClip">
            <Path d={BODY_PATH} />
          </ClipPath>
        </Defs>

        {/* White body so coffee + logo read cleanly */}
        <Path d={BODY_PATH} fill={colors.white} />

        {/* Rising coffee, clipped to the body */}
        <G clipPath="url(#bodyClip)">
          <AnimatedRect x={15} y={fillY} width={90} height={fillH} fill="url(#coffee)" />
          <AnimatedEllipse cx={60} cy={fillY} rx={32} ry={2.6} fill="#9C7853" opacity={surfaceOpacity} />
        </G>

        {/* Body rib lines (top + bottom) like the reference */}
        <Line x1={28} y1={65} x2={92} y2={65} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
        <Line x1={35} y1={119} x2={85} y2={119} stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />

        {/* Two-bean coffee logo (white-filled so it stays visible over coffee) */}
        <CoffeeBean cx={53} cy={86} rot={42} />
        <CoffeeBean cx={67} cy={95} rot={42} />

        {/* Body outline last, crisp over the fill */}
        <Path d={BODY_PATH} fill="none" stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />

        {/* Collar / neck */}
        <Path
          d="M18 41 L102 41 L96 55 L24 55 Z"
          fill={colors.white}
          stroke={STROKE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />

        {/* Lid band */}
        <Rect x={10} y={26} width={100} height={14} rx={5} fill={colors.white} stroke={STROKE} strokeWidth={SW} />

        {/* Lid lip (flared trapezoid) */}
        <Path
          d="M24 12 Q23 10 26 10 L94 10 Q97 10 96 12 L108 25 L12 25 Z"
          fill={colors.white}
          stroke={STROKE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />

        {/* Flared base */}
        <Path
          d="M34 131 L86 131 L80 145 Q79 147 76 147 L44 147 Q41 147 40 145 Z"
          fill={colors.white}
          stroke={STROKE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

// A single coffee bean: a white-filled oval with a curved seam, rotated.
function CoffeeBean({ cx, cy, rot }: { cx: number; cy: number; rot: number }) {
  return (
    <G origin={`${cx}, ${cy}`} rotation={rot}>
      <Ellipse cx={cx} cy={cy} rx={11} ry={6.4} fill={colors.white} stroke={STROKE} strokeWidth={2.6} />
      <Path
        d={`M${cx - 7} ${cy} Q${cx} ${cy + 3} ${cx + 7} ${cy}`}
        fill="none"
        stroke={STROKE}
        strokeWidth={2.6}
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
