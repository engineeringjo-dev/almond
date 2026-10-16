import type { Href } from 'expo-router';

/**
 * WHERE «رجوع» GOES WHEN NOTHING IS BEHIND THE SCREEN.
 *
 * A screen opened cold — a notification, a shared link, a refresh in the
 * browser — has no history, and the navigator then draws no back button at
 * all: the wallet and the points history were dead ends (seen on the web
 * build, 2026-10-15). Every stack screen's header uses BackButton, which goes
 * back when it can and to the screen's home in the app when it cannot.
 * Precedent: Apple HIG, every pushed screen has a way back, and Material 3's
 * "Up" goes to the logical parent, not only to the last screen.
 */
const PARENT: Record<string, Href> = {
  loyalty: '/(tabs)/rewards',
  tiers: '/(tabs)/rewards',
  vouchers: '/(tabs)/rewards',
  referral: '/(tabs)/profile',
  transfer: '/(tabs)/profile',
  profile: '/(tabs)/profile',
  'order/[id]': '/(tabs)/track',
  notifications: '/(tabs)',
};

export function backFallback(routeName: string): Href {
  return PARENT[routeName] ?? '/(tabs)';
}
