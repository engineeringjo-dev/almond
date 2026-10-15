import { Alert, Platform } from 'react-native';

/**
 * A MESSAGE OR A QUESTION THAT REACHES THE WEB TOO.
 *
 * react-native-web's Alert is `static alert() {}`: it does nothing. On the web
 * build a member tapped «1.000 د.أ» to redeem and nothing happened, ever, and
 * «بياناتك» refused an empty name in silence (layout panel, 2026-10-15). On the
 * web these use the browser's own dialogs, which every browser and screen
 * reader knows; on the phone, Alert, as before.
 *
 * Precedent: the React Native docs list Alert as not implemented on the web;
 * Expo's guidance for a confirmation there is window.confirm.
 */
interface BrowserDialogs {
  alert(message: string): void;
  confirm(message: string): boolean;
}

function browser(): BrowserDialogs | null {
  if (Platform.OS !== 'web') return null;
  const w = (globalThis as { window?: Partial<BrowserDialogs> }).window;
  return w && typeof w.alert === 'function' && typeof w.confirm === 'function' ? (w as BrowserDialogs) : null;
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

/** Ask before an action that cannot be taken back; `onConfirm` runs on yes. */
export function confirmAction(opts: {
  title: string;
  body?: string;
  confirm: string;
  cancel: string;
  onConfirm: () => void;
}): void {
  const web = browser();
  if (web) {
    if (web.confirm(message(opts.title, opts.body))) opts.onConfirm();
    return;
  }
  Alert.alert(opts.title, opts.body, [
    { text: opts.cancel, style: 'cancel' },
    { text: opts.confirm, onPress: opts.onConfirm },
  ]);
}
