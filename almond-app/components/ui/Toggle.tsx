import { Switch } from 'react-native';
import { colors } from '@/constants/theme';

export function Toggle({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: colors.warmGray, true: colors.green }}
      thumbColor={colors.white}
      ios_backgroundColor={colors.warmGray}
    />
  );
}
