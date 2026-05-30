import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors, fontFamily } from '@/constants/theme';
import { TabBarIcon } from '@/components/ui/TabBarIcon';
import { useCartCount } from '@/stores/cartStore';

export default function TabsLayout() {
  const { t } = useTranslation();
  const cartCount = useCartCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.warmGray,
        tabBarStyle: {
          backgroundColor: colors.cardBg,
          borderTopColor: colors.cream,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: t('tabs.menu'),
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('tabs.cart'),
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.gold, color: colors.dark },
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="🛒" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: t('tabs.track'),
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="📍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => <TabBarIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
