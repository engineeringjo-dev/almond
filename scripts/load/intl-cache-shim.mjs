/**
 * MEASUREMENT ONLY — never loaded by the server in any real deployment.
 *
 * Simulates the proposed fix for packages/shared/src/lib/ammanWeekday.ts
 * (hoist the Intl.DateTimeFormat out of ammanDayKey/ammanWeekday) without
 * editing that package: every `new Intl.DateTimeFormat(locale, options)` with
 * identical arguments returns ONE cached instance. `LOAD_INTL_CACHE=1` makes
 * bff-baseline.ts start the server with `--import` of this file, so the
 * before/after of the patch can be measured on the same machine.
 */
const Original = Intl.DateTimeFormat;
const cache = new Map();
function Cached(locales, options) {
  const key = JSON.stringify([locales ?? null, options ?? null]);
  let f = cache.get(key);
  if (!f) { f = new Original(locales, options); cache.set(key, f); }
  return f;
}
Cached.prototype = Original.prototype;
Cached.supportedLocalesOf = Original.supportedLocalesOf.bind(Original);
Intl.DateTimeFormat = Cached;
