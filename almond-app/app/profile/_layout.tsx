import { Stack } from 'expo-router';
import { colors, fontFamily } from '@/constants/theme';

export default function ProfileStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.cream },
        headerTintColor: colors.dark,
        headerTitleStyle: { fontFamily: fontFamily.bold },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.cream },
      }}
    />
  );
}
