import type { CheckoutBlock } from '@/lib/cartBranch';

/**
 * BACK TO THE CHECKOUT AFTER SIGN-IN.
 *
 * A guest who tapped «مراجعة الطلب» was sent to login, and after the OTP the
 * app replaced to the tabs root — Home. The first-time customer, the most
 * fragile conversion there is, had to find their cart again (audit P1).
 *
 * The gate now passes `returnTo`, and login/OTP hand the customer back to it.
 * `returnTo` arrives as a URL parameter, so it is untrusted: only an exact,
 * listed in-app path is honoured — never a scheme, a host, `//evil`, a
 * backslash or `..` — or a deep link could turn sign-in into an open redirect.
 * Parsed by hand: React Native's URL polyfill has no reliable searchParams.
 */

/** Where the cart's checkout gate asks to come back to: the cart, review open. */
export const CHECKOUT_RETURN = '/cart?review=1';

/** In-app paths a sign-in may return to, and the parameters each may carry. */
const RETURN_ROUTES: Record<string, readonly string[]> = {
  '/cart': ['review'],
};

/**
 * The internal route to go to after sign-in, or `null` for "use the default".
 * `withParams: false` drops the parameters (a guest cannot open the review).
 */
export function safeReturnTo(raw: unknown, withParams = true): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 200) return null;
  const [path, query = '', ...rest] = raw.split('?');
  if (rest.length > 0 || raw.includes('#')) return null;
  const allowed = Object.prototype.hasOwnProperty.call(RETURN_ROUTES, path) ? RETURN_ROUTES[path] : null;
  if (!allowed) return null;
  if (!withParams) return path;

  const kept: string[] = [];
  for (const pair of query.split('&')) {
    if (pair === '') continue;
    const [key, value] = pair.split('=');
    // Only a known flag, only the value "1": nothing else is passed through.
    if (allowed.includes(key) && value === '1' && !kept.includes(`${key}=1`)) kept.push(`${key}=1`);
  }
  return kept.length > 0 ? `${path}?${kept.join('&')}` : path;
}

/**
 * The cart, opened with `review=1`: open the review, wait (branches still
 * loading), or drop the flag (signed out, empty cart, or no branch to show).
 */
export function reviewOnReturn(input: {
  review: string | undefined;
  isAuthenticated: boolean;
  itemCount: number;
  block: CheckoutBlock | null;
}): 'none' | 'open' | 'wait' | 'drop' {
  if (input.review !== '1') return 'none';
  if (!input.isAuthenticated || input.itemCount === 0) return 'drop';
  if (input.block === 'branchLoading') return 'wait';
  return input.block ? 'drop' : 'open';
}
