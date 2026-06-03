import Svg, { G, Path, Circle, Rect, Ellipse } from 'react-native-svg';
import type { GiftOccasion } from '@/types';

/** Which decorative motif each occasion uses. */
type Motif = 'confetti' | 'hearts' | 'stars' | 'beans' | 'moon';

const MOTIF: Record<GiftOccasion, Motif> = {
  birthday: 'confetti',
  congrats: 'confetti',
  celebration: 'confetti',
  graduation: 'confetti',
  thankyou: 'hearts',
  loveyou: 'hearts',
  wedding: 'hearts',
  newbaby: 'hearts',
  getwell: 'hearts',
  eid: 'moon',
  ramadan: 'moon',
  friday: 'stars',
  anytime: 'beans',
  fun: 'beans',
};

const HEART = 'M8 14.2C8 14.2 1.6 10.3 1.6 5.7C1.6 3.3 3.4 2 5.1 2C6.3 2 7.4 2.7 8 3.7C8.6 2.7 9.7 2 10.9 2C12.6 2 14.4 3.3 14.4 5.7C14.4 10.3 8 14.2 8 14.2Z';
const STAR = 'M8 0L9.7 6.3L16 8L9.7 9.7L8 16L6.3 9.7L0 8L6.3 6.3Z';
const MOON = 'M15 1A8 8 0 1 0 15 17A6.2 6.2 0 1 1 15 1Z';

// Deterministic scatter: [x, y, scale, opacity, rotation]
const SCATTER: [number, number, number, number, number][] = [
  [24, 30, 1.1, 0.22, -12],
  [110, 18, 0.7, 0.16, 20],
  [180, 44, 1.3, 0.20, 8],
  [250, 24, 0.8, 0.14, -18],
  [300, 70, 1.0, 0.18, 14],
  [60, 86, 0.9, 0.15, 24],
  [150, 104, 0.7, 0.13, -8],
  [225, 96, 1.1, 0.17, 16],
  [40, 130, 0.8, 0.14, -20],
  [285, 132, 0.7, 0.12, 10],
];

interface Props {
  occasion: GiftOccasion;
  /** Decoration colour (white over dark gradients, dark over the light one). */
  color: string;
}

/**
 * Decorative occasion artwork drawn over the gift-card gradient (react-native-svg).
 * Hearts / confetti / stars / coffee beans / crescent moon, scattered softly.
 */
export function GiftCardArt({ occasion, color }: Props) {
  const motif = MOTIF[occasion] ?? 'beans';

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 320 160"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      {SCATTER.map(([x, y, s, o, rot], i) => {
        const key = `${i}`;
        if (motif === 'hearts') {
          return (
            <G key={key} transform={`translate(${x} ${y}) scale(${s}) rotate(${rot})`} opacity={o}>
              <Path d={HEART} fill={color} />
            </G>
          );
        }
        if (motif === 'stars') {
          return (
            <G key={key} transform={`translate(${x} ${y}) scale(${s}) rotate(${rot})`} opacity={o}>
              <Path d={STAR} fill={color} />
            </G>
          );
        }
        if (motif === 'beans') {
          return (
            <G key={key} transform={`translate(${x} ${y}) scale(${s}) rotate(${rot})`} opacity={o}>
              <Ellipse cx={6} cy={8} rx={5} ry={7.5} fill={color} />
              <Path d="M6 1.5C3 4 3 12 6 14.5" stroke={color} strokeWidth={1} fill="none" opacity={0.5} />
            </G>
          );
        }
        if (motif === 'moon') {
          // alternate crescents and little stars
          return i % 2 === 0 ? (
            <G key={key} transform={`translate(${x} ${y}) scale(${s * 0.9}) rotate(${rot})`} opacity={o}>
              <Path d={MOON} fill={color} />
            </G>
          ) : (
            <G key={key} transform={`translate(${x} ${y}) scale(${s * 0.6})`} opacity={o}>
              <Path d={STAR} fill={color} />
            </G>
          );
        }
        // confetti: alternate dots and little tilted bars
        return i % 2 === 0 ? (
          <Circle key={key} cx={x} cy={y} r={4 * s} fill={color} opacity={o} />
        ) : (
          <Rect
            key={key}
            x={x}
            y={y}
            width={10 * s}
            height={4 * s}
            rx={2}
            fill={color}
            opacity={o}
            transform={`rotate(${rot} ${x} ${y})`}
          />
        );
      })}
    </Svg>
  );
}
