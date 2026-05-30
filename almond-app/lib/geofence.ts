import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { config } from '@/constants/config';
import { branches } from '@/services/seed';
import { notificationService } from '@/services/notification.service';

/**
 * Geofence engine (section 14.2): one region per branch. On region ENTER →
 * server checks the daily cap → if allowed, a balance-nudge push is sent.
 * Daily cap + prize selection stay server-side; reinstalling can't bypass it.
 *
 * iOS allows max 20 simultaneous regions; we have 6 branches (fine).
 */
export const GEOFENCE_TASK = 'almond-geofence-task';
const USER_KEY = 'almond.geofence.userId';

// Background geofencing is native-only; the task must be defined at module
// scope so the OS can invoke it. Web has no TaskManager — skip registration.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
    if (error) return;
    const { eventType, region } = (data ?? {}) as {
      eventType?: Location.GeofencingEventType;
      region?: Location.LocationRegion & { identifier?: string };
    };
    if (eventType !== Location.GeofencingEventType.Enter) return;

    try {
      const userId = (await AsyncStorage.getItem(USER_KEY)) ?? 'guest';
      const branchId = region?.identifier ?? '';
      // Server enforces the once-per-day cap and sends the balance push.
      await notificationService.geofenceTriggered(userId, branchId);
    } catch {
      // swallow — background task must not throw
    }
  });
}

/**
 * Start geofencing. Requires background-location permission + explicit opt-in
 * (handled by the pre-permission explainer screen, section 14.2).
 */
export async function startGeofencing(userId: string): Promise<boolean> {
  if (Platform.OS === 'web') return false; // no background geofencing on web
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return false;

    await AsyncStorage.setItem(USER_KEY, userId);

    const regions: Location.LocationRegion[] = branches.map((b) => ({
      identifier: b.id,
      latitude: b.lat,
      longitude: b.lng,
      radius: config.GEOFENCE_RADIUS_M, // editable from admin panel in prod
      notifyOnEnter: true,
      notifyOnExit: false,
    }));

    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    return true;
  } catch {
    return false;
  }
}

export async function stopGeofencing(): Promise<void> {
  try {
    const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK);
  } catch {
    // ignore
  }
}
