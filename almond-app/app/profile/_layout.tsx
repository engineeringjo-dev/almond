import { Stack } from 'expo-router';

import { BackButton } from '@/components/ui/BackButton';
import { colors, fontFamily } from '@/constants/theme';
import { backFallback } from '@/lib/backFallback';

export default function ProfileStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.cream },
        headerTintColor: colors.dark,
        headerTitleStyle: { fontFamily: fontFamily.bold },
        headerShadowVisible: false,
        // The same back as every stack screen; a cold link to a profile
        // screen lands on the profile tab (lib/backFallback).
        headerLeft: () => <BackButton fallback={backFallback('profile')} inHeader />,
        contentStyle: { backgroundColor: colors.cream },
      }}
    />
  );
}
