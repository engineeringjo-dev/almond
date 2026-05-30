import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import { notificationService } from '@/services/notification.service';

/**
 * Notification client wiring (section 14). The send/trigger layer is mocked
 * (section 14 intro); here we wire permissions, the Expo push token, and the
 * foreground handler. All calls are defensive so the app never crashes if a
 * capability is unavailable (e.g. simulator).
 */

// Show alerts while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPush(userId: string): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Almond',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    if (!Device.isDevice) return null; // push tokens require a physical device

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    // projectId comes from EAS config in production; guarded for dev.
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await notificationService.registerToken(userId, token, Platform.OS);
    return token;
  } catch {
    return null;
  }
}

/**
 * Mock trigger: schedule a local notification so the inbox/flow can be demoed
 * without a real push server (section 14 — "mock the triggers").
 */
export async function sendMockLocalNotification(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null, // immediately
    });
  } catch {
    // ignore in environments without notification support
  }
}
