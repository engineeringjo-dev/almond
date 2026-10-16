import { Linking, Platform } from 'react-native';
import { setStringAsync } from 'expo-clipboard';
import type { ReferralWire } from '@almond/shared/loyalty/referral';

export type ReferralRewardState = 'eligible' | 'limit-reached' | 'ineligible';

/** Presentation follows server eligibility and budget; it never redecides them. */
export function referralRewardState(
  referral: Pick<ReferralWire, 'eligibleForRewards' | 'remainingPoints'>,
): ReferralRewardState {
  if (referral.remainingPoints <= 0) return 'limit-reached';
  return referral.eligibleForRewards ? 'eligible' : 'ineligible';
}

/** WhatsApp's prefilled-message link: the member chooses a contact and sends. */
export function referralWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export async function openReferralWhatsApp(message: string): Promise<void> {
  await Linking.openURL(referralWhatsAppUrl(message));
}

/** Copy the server's exact invitation URL, never a locally rebuilt link. */
export async function copyReferralLink(link: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Expo 56's legacy web fallback reports true even when execCommand
    // returns false. Await the browser's actual write, or show manual recovery.
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard?.writeText) throw new Error('referral_clipboard_unavailable');
    await clipboard.writeText(link);
    return;
  }
  // Expo's native contract returns true on success; never silently accept
  // a failed write even if a platform adapter resolves instead of rejecting.
  if (!await setStringAsync(link)) throw new Error('referral_link_not_copied');
}
