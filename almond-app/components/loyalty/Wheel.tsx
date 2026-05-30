import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';

import { colors } from '@/constants/theme';
import type { SpinPrize } from '@/types';

export interface WheelHandle {
  /** Spin so the given enabled-prize index lands under the top pointer. */
  spinTo: (index: number) => Promise<void>;
}

interface Props {
  prizes: SpinPrize[]; // enabled prizes, in order
  size?: number;
  lang: 'ar' | 'en';
}

// Segments use the active theme exclusively (green primary + gold accent),
// separated by cream — so the wheel re-skins automatically with the theme.
function segmentFill(index: number): string {
  return index % 2 === 0 ? colors.primary : colors.gold;
}
function segmentText(index: number): string {
  // Cream on green, dark on gold — always high contrast.
  return index % 2 === 0 ? colors.cream : colors.dark;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function wedgePath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y} Z`;
}

export const Wheel = forwardRef<WheelHandle, Props>(({ prizes, size = 300, lang }, ref) => {
  const rotation = useRef(new Animated.Value(0)).current;
  const currentDeg = useRef(0);
  const n = Math.max(1, prizes.length);
  const seg = 360 / n;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  useImperativeHandle(ref, () => ({
    spinTo: (index: number) =>
      new Promise((resolve) => {
        const centerAngle = (index + 0.5) * seg;
        // Rotation needed to bring this segment center to the top pointer.
        const desiredMod = (360 - centerAngle) % 360;
        const curMod = ((currentDeg.current % 360) + 360) % 360;
        const delta = (desiredMod - curMod + 360) % 360;
        const jitter = (Math.random() - 0.5) * seg * 0.5;
        const target = currentDeg.current + 360 * 5 + delta + jitter;
        currentDeg.current = target;
        Animated.timing(rotation, {
          toValue: target,
          duration: 4200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => resolve());
      }),
  }));

  const paths = useMemo(
    () =>
      prizes.map((p, i) => {
        const start = i * seg;
        const end = (i + 1) * seg;
        const mid = (start + end) / 2;
        const labelPos = polar(cx, cy, r * 0.62, mid);
        const fill = segmentFill(i);
        const textColor = segmentText(i);
        const label = lang === 'ar' ? p.nameAr : p.nameEn;
        return { path: wedgePath(cx, cy, r, start, end), fill, labelPos, textColor, label, mid, id: p.id };
      }),
    [prizes, seg, cx, cy, r, lang],
  );

  const spin = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Svg width={size} height={size}>
          <G>
            {paths.map((p) => (
              <G key={p.id}>
                <Path d={p.path} fill={p.fill} stroke={colors.cream} strokeWidth={2} />
                <SvgText
                  x={p.labelPos.x}
                  y={p.labelPos.y}
                  fill={p.textColor}
                  fontSize={size * 0.038}
                  fontWeight="bold"
                  textAnchor="middle"
                  transform={`rotate(${p.mid}, ${p.labelPos.x}, ${p.labelPos.y})`}
                >
                  {p.label.length > 14 ? `${p.label.slice(0, 13)}…` : p.label}
                </SvgText>
              </G>
            ))}
          </G>
        </Svg>
      </Animated.View>
      {/* Hub */}
      <View style={[styles.hub, { width: size * 0.12, height: size * 0.12, borderRadius: size * 0.06 }]} />
    </View>
  );
});

Wheel.displayName = 'Wheel';

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  hub: {
    position: 'absolute',
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: colors.gold,
  },
});
