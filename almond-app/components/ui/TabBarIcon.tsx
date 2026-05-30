import { StyleSheet, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { colors } from '@/constants/theme';

/** Tab icon from the unified icon set (Master Pack §M — no emoji). */
export function TabBarIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={styles.wrap}>
      <Icon
        name={name}
        size={23}
        color={focused ? colors.primary : colors.warmGray}
        strokeWidth={focused ? 2.4 : 2}
      />
      {focused ? <View style={styles.dot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gold,
    marginTop: 3,
  },
});
