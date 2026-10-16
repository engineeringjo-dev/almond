import { Alert, Platform } from 'react-native';

/**
 * A MESSAGE THAT REACHES THE WEB TOO.
 *
 * react-native-web's Alert is `static alert() {}`: it does nothing. On the web
 * build «بياناتك» refused an empty name in silence (layout panel,
 * 2026-10-15). On the web this uses the browser's own alert, which every
 * browser and screen reader knows; on the phone, Alert, as before.
 *
 * There was a `confirmAction` here too, for the redeem button. The redemption
 * now asks in a sheet on the Rewards tab (components/loyalty/RedeemSheet.tsx),
 * which can also show a failure with a retry and the way to the coupon it
 * made, so the question form had no caller left and went.
 *
 * Precedent: the React Native docs list Alert as not implemented on the web.
 */
interface BrowserDialogs {
  alert(message: string): void;
}

function browser(): BrowserDialogs | null {
  if (Platform.OS !== 'web') return null;
  const w = (globalThis as { window?: Partial<BrowserDialogs> }).window;
  return w && typeof w.alert === 'function' ? (w as BrowserDialogs) : null;
}

const message = (title: string, body?: string) => (body ? `${title}\n\n${body}` : title);

/** Tell the member something: a result, or why an action was refused. */
export function notify(title: string, body?: string): void {
  const web = browser();
  if (web) {
    web.alert(message(title, body));
    return;
  }
  Alert.alert(title, body);
}
