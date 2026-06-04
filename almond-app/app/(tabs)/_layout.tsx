import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontFamily } from '@/constants/theme';
import { TabBarIcon } from '@/components/ui/TabBarIcon';
import { TabBarBarcodeButton } from '@/components/ui/TabBarBarcodeButton';
import { useUserId } from '@/stores/authStore';
import { registerForPush } from '@/lib/notifications';

/**
 * Five fixed sections (Order Spec §1): Home · Order · Barcode (raised centre) ·
 * Rewards · More. Cart and Track stay as routes (reachable from the cart icon /
 * deep links) but are hidden from the bar to keep it to five clear choices
 * (Hick's Law). Menu is folded into the Order screen's first sub-tab.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const userId = useUserId();
  const insets = useSafeAreaInsets();
  // Reserve room for the system gesture/nav bar so labels never clip.
  const bottomPad = Math.max(insets.bottom, 10);

  // Wire push registration once the user lands in the app (section 14).
  useEffect(() => {
    registerForPush(userId);
  }, [userId]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.warmGray,
        tabBarStyle: {
          backgroundColor: colors.cardBg,
          borderTopColor: colors.neutralWarm,
          height: 62 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: 11, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused }) => <TabBarIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="order"
        options={{
          title: t('tabs.order'),
          tabBarIcon: ({ focused }) => <TabBarIcon name="coffee" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="pay"
        options={{
          title: t('tabs.barcode'),
          tabBarButton: (props) => (
            <TabBarBarcodeButton
              focused={props.accessibilityState?.selected ?? false}
              onPress={props.onPress}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: t('tabs.rewards'),
          tabBarIcon: ({ focused }) => <TabBarIcon name="bean" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.more'),
          tabBarIcon: ({ focused }) => <TabBarIcon name="more" focused={focused} />,
        }}
      />

      {/* Hidden routes — still navigable, not shown in the five-section bar. */}
      <Tabs.Screen name="menu" options={{ href: null }} />
      <Tabs.Screen name="cart" options={{ href: null }} />
      <Tabs.Screen name="track" options={{ href: null }} />
    </Tabs>
  );
}
