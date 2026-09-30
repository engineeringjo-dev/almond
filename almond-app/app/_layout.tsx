import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import { initI18n } from '@/lib/i18n';
import { applyWebViewportFix } from '@/lib/webViewportFix';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { useFavouritesStore } from '@/stores/favouritesStore';
import { usePromoStore } from '@/stores/promoStore';
import { usePromotionStore } from '@/stores/promotionStore';
import { useAppFonts } from '@/constants/fonts';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { CartToast } from '@/components/ui/CartToast';
import { colors } from '@/constants/theme';
import { hydrateMenuFromCache, refreshMenu } from '@/services/menuSync';

// Initialize i18n as early as possible (AR default).
initI18n();

// Web: pin the app to the dynamic viewport height so the bottom tab bar clears
// the device's system navigation bar (no-op on native).
applyWebViewportFix();

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 min — light caching per success factors (section 11)
      retry: 1,
    },
  },
});

/** How often returning to the app may re-check the menu. */
const MENU_REFRESH_MIN_MS = 5 * 60 * 1000;

export default function RootLayout() {
  const [fontsLoaded] = useAppFonts();
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateFavourites = useFavouritesStore((s) => s.hydrate);
  const hydratePromo = usePromoStore((s) => s.hydrate);
  const hydratePromotion = usePromotionStore((s) => s.hydrate);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hydrate();
    hydrateAuth();
    hydrateFavourites();
    hydratePromo();
    // The celebration's high-water mark. Until this resolves the store
    // refuses to fold in an observation at all — see promotionStore.observe().
    hydratePromotion();
  }, [hydrate, hydrateAuth, hydrateFavourites, hydratePromo, hydratePromotion]);

  // THE MENU UPDATES LIKE CAREEM/TALABAT (GM, 2026-09-30): cached menu at
  // launch, then the server's newer menu in the background, and again when the
  // customer comes back to the app. Screens refetch when it changes.
  // services/menuSync.ts and packages/shared/src/menu/remote.ts have the rules.
  useEffect(() => {
    let last = 0;
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['menu'] });
    const sync = () => {
      if (Date.now() - last < MENU_REFRESH_MIN_MS) return;
      last = Date.now();
      refreshMenu().then((r) => { if (r === 'updated') invalidate(); }).catch(() => {});
    };
    hydrateMenuFromCache().then((fromCache) => { if (fromCache) invalidate(); }).finally(sync);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') sync(); });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontsLoaded === undefined) && hydrated) {
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, hydrated]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.cream },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="order/confirm"
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen name="order/[id]" />
            <Stack.Screen name="loyalty" />
            <Stack.Screen
              name="notifications"
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen name="referral" />
            <Stack.Screen name="transfer" />
          </Stack>
          <CartToast />
          </ErrorBoundary>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
