import { Switch, type ColorValue } from 'react-native';
import { colors } from '@/constants/theme';

declare module 'react-native' {
  interface SwitchProps {
    /** react-native-web only: the thumb while the switch is on. Unset, the
     *  web build paints Material's teal, #009688. Native ignores it. */
    activeThumbColor?: ColorValue;
  }
}

/**
 * The app's switch. `label` is required: an unlabelled switch is announced as a
 * bare "switch" (the curbside toggle was, axe `label` critical).
 *
 * On is the ink, off is the control boundary — the identity's two colours, in
 * both schemes (shared theme). It was green on a grey track, and on the web its
 * thumb was react-native-web's default teal: two colours the black-and-white
 * identity does not have. Precedent: Material 3 switch — the selected track in
 * the primary colour, the handle in "on primary"; the unselected track drawn
 * by the outline colour. The state is also the thumb's position and the
 * switch's checked state, never the colour alone (WCAG 1.4.1).
 */
export function Toggle({
  value,
  onValueChange,
  label,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      aria-label={label}
      trackColor={{ false: colors.outline, true: colors.primary }}
      thumbColor={colors.onInk}
      activeThumbColor={colors.onInk}
      ios_backgroundColor={colors.outline}
    />
  );
}
