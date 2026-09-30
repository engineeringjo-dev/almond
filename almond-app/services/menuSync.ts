import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/constants/config';
import { APP_MENU_SCHEMA, parseAppMenuPayload, type AppMenuPayload } from '@almond/shared/menu/remote';
import { getMenu, setMenu } from '@almond/shared/menu/store';
import { menuPulledAt } from '@almond/shared/menu/menu.generated';

/**
 * MENU SYNC — the app's menu updates like Careem/Talabat, with no store
 * release (GM, 2026-09-30). packages/shared/src/menu/remote.ts has the rules.
 *
 *   launch        → the cached server menu, if any (instant, works offline)
 *   then          → GET config.MENU_URL in the background; a valid, newer menu
 *                   replaces the one on screen and becomes the new cache
 *   back to app   → the same refresh, at most once every few minutes
 *
 * Whatever goes wrong — offline, timeout, a bad payload, a menu shape this
 * build cannot render — the app keeps the menu it already has. The bundled
 * menu is the floor: it can be replaced only by something at least as new.
 */

/** Keyed by schema: a cache written by an older build is never read by a newer one. */
export const MENU_CACHE_KEY = `almond.menu.schema${APP_MENU_SCHEMA}`;
const TIMEOUT_MS = 6000;

export type RefreshResult = 'updated' | 'unchanged' | 'needs_app_update' | 'invalid' | 'offline';

/** Never go backwards: a payload older than the menu bundled in THIS build is
 *  ignored (a store update can ship a newer menu than an old cache). */
const notOlderThanBundled = (p: AppMenuPayload) => p.updatedAt >= menuPulledAt;

export async function hydrateMenuFromCache(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(MENU_CACHE_KEY);
    if (!raw) return false;
    const parsed = parseAppMenuPayload(JSON.parse(raw));
    if (!parsed.ok || !notOlderThanBundled(parsed.payload)) {
      await AsyncStorage.removeItem(MENU_CACHE_KEY);
      return false;
    }
    return setMenu(parsed.payload, 'cache');
  } catch {
    return false;
  }
}

export async function refreshMenu(fetchImpl: typeof fetch = fetch): Promise<RefreshResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let raw: unknown;
  try {
    const res = await fetchImpl(config.MENU_URL, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) return 'offline';
    raw = await res.json();
  } catch {
    return 'offline';
  } finally {
    clearTimeout(timer);
  }
  const parsed = parseAppMenuPayload(raw);
  if (!parsed.ok) return parsed.reason;
  if (!notOlderThanBundled(parsed.payload)) return 'unchanged';
  if (!setMenu(parsed.payload, 'server')) return 'unchanged';
  try {
    await AsyncStorage.setItem(MENU_CACHE_KEY, JSON.stringify(parsed.payload));
  } catch {
    // Cache is a convenience; the new menu is already on screen.
  }
  return 'updated';
}

/** The version on screen — for support ("which menu do you see?"). */
export function menuVersion(): { version: string; source: string } {
  const m = getMenu();
  return { version: m.version, source: m.source };
}
