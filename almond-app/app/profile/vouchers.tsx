import { Redirect } from 'expo-router';

/**
 * `/profile/vouchers` is «قسائمي», which moved to the Rewards tab's door
 * (app/vouchers.tsx). The path stays valid for old links, bookmarks and a
 * notification sent before the move, and lands on the one real page — the
 * same shape as `/menu` (W2).
 */
export default function VouchersRedirect() {
  return <Redirect href="/vouchers" />;
}
