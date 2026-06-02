import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Polygon,
  Path,
  Rect,
  ClipPath,
} from 'react-native-svg';
import { colors, fontFamily } from '@/constants/theme';

interface Props {
  current: number;
  target: number;
  size?: number;
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// White paper cup body (tapered) in a 100×100 viewBox.
const TOP_Y = 36;
const BOT_Y = 90;
const BODY = '26,36 74,36 64,90 36,90';

/**
 * The Cup (loyalty progress) styled as an Almond paper cup: white body, black
 * lid, "ألموند" on the body. A soft gold "drink" rises from the bottom as the
 * user collects drinks (spring fill). Target 10 with a 1-drink head-start.
 */
export function Cup({ current, target, size = 96 }: Props) {
  const pct = Math.max(0, Math.min(1, current / target));
  const level = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(level, { toValue: pct, friction: 6, tension: 36, useNativeDriver: false }).start();
  }, [pct, level]);

  const liquidY = level.interpolate({ inputRange: [0, 1], outputRange: [BOT_Y, TOP_Y] });
  const liquidH = level.interpolate({ inputRange: [0, 1], outputRange: [0, BOT_Y - TOP_Y] });
  const nearFull = pct >= 0.9;

  return (
    <View style={[styles.wrap, { width: size, height: size }, nearFull && styles.glow]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="brew" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.lightGold} />
            <Stop offset="1" stopColor={colors.gold} />
          </LinearGradient>
          <ClipPath id="cup">
            <Polygon points={BODY} />
          </ClipPath>
        </Defs>

        {/* white paper body */}
        <Polygon points={BODY} fill="#FFFFFF" />
        {/* animated gold drink rising inside the body */}
        <AnimatedRect x={18} y={liquidY} width={64} height={liquidH} fill="url(#brew)" clipPath="url(#cup)" />
        {/* body outline */}
        <Polygon points={BODY} fill="none" stroke="#1A1A1A" strokeWidth={3} strokeLinejoin="round" />

        {/* black lid: flat rim + raised dome */}
        <Rect x={17} y={25} width={66} height={10} rx={3} fill="#111111" />
        <Rect x={33} y={16} width={34} height={11} rx={5} fill="#111111" />
      </Svg>

      {/* brand name on the cup (RN text for correct Arabic shaping) */}
      <Text
        style={[
          styles.brand,
          { fontSize: size * 0.135, top: size * 0.5, width: size },
        ]}
        numberOfLines={1}
      >
        ألموند
      </Text>
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
  brand: {
    position: 'absolute',
    textAlign: 'center',
    color: '#1A1A1A',
    fontFamily: fontFamily.bold,
  },
});
