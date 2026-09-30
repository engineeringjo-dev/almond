import { Switch } from 'react-native';
import { colors } from '@/constants/theme';

/**
 * The app's switch. `label` is required: an unlabelled switch is announced as a
 * bare "switch" (the curbside toggle was, axe `label` critical).
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
      trackColor={{ false: colors.warmGray, true: colors.green }}
      thumbColor={colors.white}
      ios_backgroundColor={colors.warmGray}
    />
  );
}
