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
 * Rewards · More. Track stays a route (reachable from deep links) but is hidden
 * from the bar to keep it to five clear choices (Hick's Law). Menu is folded
 * into the Order screen's first sub-tab. The cart is NOT a tab: it is a stack
 * screen above the tabs (app/cart.tsx), with a real back.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const userId = useUserId();
  const insets = useSafeAreaInsets();
  // Reserve room for the system gesture/nav bar (iOS home indicator / Android
  // nav) so the bar clears it and labels never clip. On web the served HTML
  // sets viewport-fit=cover, so insets.bottom reflects the real system inset
  // (read via env(safe-area-inset-bottom)); 16 is the minimum breathing room.
  const bottomPad = Math.max(insets.bottom, 16);

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
          borderTopWidth: 1,
          // Tall enough that icon + Arabic label + react-navigation's per-tab
          // padding all fit inside the content area (above paddingBottom) so the
          // label never overflows/clips at the bottom.
          height: 78 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.medium,
          fontSize: 11,
          lineHeight: 16,
          marginTop: 2,
        },
        tabBarItemStyle: { paddingVertical: 0 },
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
          // The bar hands its tabs `aria-selected`, not accessibilityState — the
          // old read was always false, so the FAB never showed it was active.
          tabBarButton: (props) => (
            <TabBarBarcodeButton
              focused={props['aria-selected'] === true}
              role={props.role}
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
      {/* `/menu` only redirects to Order › القائمة (old links keep working). */}
      <Tabs.Screen name="menu" options={{ href: null }} />
      <Tabs.Screen name="track" options={{ href: null }} />
    </Tabs>
  );
}
