import { ComponentType, ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient as RawLinearGradient } from 'expo-linear-gradient';
import { gradients } from '@/constants/theme';

// expo-linear-gradient ships a class-component type that TS' JSX checker
// rejects under strict mode; cast to a functional component type.
const LinearGradient = RawLinearGradient as unknown as ComponentType<{
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}>;

type Preset = keyof typeof gradients;

interface Props {
  preset?: Preset;
  colors?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Diagonal by default for warmth (Revision Pack §L). */
  diagonal?: boolean;
}

export function Gradient({ preset = 'dark', colors, style, children, diagonal = true }: Props) {
  const stops = colors ?? gradients[preset];
  return (
    <LinearGradient
      colors={stops as unknown as string[]}
      start={{ x: 0, y: 0 }}
      end={diagonal ? { x: 1, y: 1 } : { x: 0, y: 1 }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}
