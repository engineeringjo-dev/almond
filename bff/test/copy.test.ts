import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { config } from '@almond/shared/config';
import { REPO, collectSources, type SourceFile } from './lib/sources';

/**
 * C1-C11 — THE CUSTOMER-FACING STRINGS.
 *
 * Four locale files (almond-app/locales/{ar,en}.json and
 * almond-web/src/messages/{ar,en}.json) were covered by NO test in either
 * suite, and every one of them was lying on screen:
 *
 *   - `tiers.bean / silver / gold / black` outlived the ids by two commits.
 *     i18next returns the KEY when it is missing and `fallbackLng: 'ar'` cannot
 *     help when ar.json is missing the same key, so every `t(`tiers.${id}`)`
 *     call site rendered the literal text "tiers.base" on the badge, the rewards
 *     carousel, the /loyalty ladder and the home card — in both languages.
 *   - `tierBenefits.earnBean/Silver/Gold/Black` said "Earn 5 / 6.25 / 7.5 / 10
 *     points per 1 JOD". The code pays 2 / 4 / 6.
 *   - `doubleDays4/6` promised Double Points Days (BONUS_BEAN_DAY.enabled:
 *     false), `cupBonus` promised a personal-cup bonus that never existed, and
 *     three strings promised "+50% points" from the wallet
 *     (WALLET_EARN_MULTIPLIER: 1.0, retired after zero rows in 171,291 live
 *     transactions).
 *   - `common.beans` existed only in en.json and `common.points` only in
 *     ar.json, and four keys used {{beans}} in one language and {{points}} in
 *     the other — so `t('rewards.away', { points })` rendered the raw
 *     placeholder "{{beans}} points away" in English.
 *
 * Every one of those is a class of defect, not an incident, so these tests
 * assert the CLASS. Run against the pre-W4 files the five C4 patterns alone
 * fire on 31 values across all four locales; against the current files, zero.
 *
 * Style follows T7/T8/T27: assert the outcome (what a member can be shown), not
 * the mechanism. The locale JSON is NOT in collectSources()' walk — its EXT is
 * /\.(tsx?|py|js)$/ — so it is read directly off REPO.
 */

const APP_LOCALES = {
  en: 'almond-app/locales/en.json',
  ar: 'almond-app/locales/ar.json',
} as const;
const WEB_LOCALES = {
  en: 'almond-web/src/messages/en.json',
  ar: 'almond-web/src/messages/ar.json',
} as const;
const ALL_LOCALES = [...Object.values(APP_LOCALES), ...Object.values(WEB_LOCALES)];

type Flat = Record<string, string>;

function flatten(value: unknown, prefix = '', out: Flat = {}): Flat {
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}

const load = (rel: string): Flat =>
  flatten(JSON.parse(readFileSync(join(REPO, rel), 'utf8')));

/** i18next uses {{x}}; next-intl uses {x}. Both are read here. */
const placeholders = (s: string): string[] =>
  [...s.matchAll(/\{\{?(\w+)\}?\}/g)].map((m) => m[1]).sort();

let sources: SourceFile[];
beforeAll(() => { sources = collectSources(); });

// ---------------------------------------------------------------------------
// C1 / C2 — the two languages must be the same file, key for key.
// ---------------------------------------------------------------------------
describe('C1 both languages carry exactly the same keys', () => {
  for (const [label, files] of [['almond-app', APP_LOCALES], ['almond-web', WEB_LOCALES]] as const) {
    it(`${label}: ar.json and en.json have identical key sets`, () => {
      const en = Object.keys(load(files.en)).sort();
      const ar = Object.keys(load(files.ar)).sort();
      const enOnly = en.filter((k) => !ar.includes(k));
      const arOnly = ar.filter((k) => !en.includes(k));
      // A one-sided key is not a missing translation — i18next renders the KEY
      // NAME, so it is literal machine text on a customer's screen.
      expect(
        { enOnly, arOnly },
        `${label}: every key must exist in BOTH languages — a key present in one`
        + ' renders as its own name in the other',
      ).toEqual({ enOnly: [], arOnly: [] });
    });
  }
});

describe('C2 a shared key interpolates the same names in both languages', () => {
  for (const [label, files] of [['almond-app', APP_LOCALES], ['almond-web', WEB_LOCALES]] as const) {
    it(`${label}: placeholder sets match`, () => {
      const en = load(files.en);
      const ar = load(files.ar);
      const bad: string[] = [];
      for (const key of Object.keys(en)) {
        if (!(key in ar)) continue;
        const a = placeholders(en[key]).join(',');
        const b = placeholders(ar[key]).join(',');
        if (a !== b) bad.push(`${key}: en{${a}} vs ar{${b}}`);
      }
      // This is what let `t('rewards.away', { points })` print the raw text
      // "{{beans}} points away" in English while Arabic read correctly.
      expect(bad, `${label}: a placeholder the caller does not pass is rendered raw`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// C4 — no string may state an earn rate. The rate IS the tier's name.
// ---------------------------------------------------------------------------
describe('C4 no customer-facing string states an earn rate', () => {
  // Each pattern is one of the four ways the rate was stated. They are matched
  // on VALUES, in every locale, so the defect cannot come back under a new key.
  const PATTERNS: { name: string; re: RegExp }[] = [
    // "Earn 5 points per 1 JOD", "earn a point per JOD", "5 نقاط لكل دينار"
    { name: 'points-per-unit', re: /(\d[\d.]*|\ban?\b)\s*(points?|نقاط|نقطة)[^"]{0,12}(per\b|for every\b|لكل|عن كل)/ },
    // The Arabic word order carries no article, so it needs its own rule:
    // "اجمع نقطة عن كل دينار" has nothing in front of the noun to anchor on.
    { name: 'points-per-unit-ar', re: /(نقاط|نقطة)[^"]{0,12}(لكل|عن كل)/ },
    // "+50% points", "50% more points", "+50% نقاط"
    { name: 'percent-points', re: /\d+(\.\d+)?\s*%[^"]{0,16}(more\s+)?(points|نقاط|نقطة)/ },
    { name: 'points-percent', re: /(points|نقاط|نقطة)[^"]{0,16}[+±]\s*\d+(\.\d+)?\s*%/ },
    // The second rung's step. The approved copy says "×2" once and never says
    // this: «المضاعف ×2 يُذكر مرة واحدة فقط … تكراره يُفقده أثره».
    { name: 'second-step-multiplier', re: /×\s*1[.,،]5/ },
  ];

  it('all four locale files are clean', () => {
    const offenders: string[] = [];
    for (const rel of ALL_LOCALES) {
      const flat = load(rel);
      for (const [key, value] of Object.entries(flat)) {
        for (const p of PATTERNS) {
          if (p.re.test(value)) offenders.push(`${rel} ${key} [${p.name}]: ${value}`);
        }
      }
    }
    expect(
      offenders,
      'a locale value may not state points-per-dinar, a percentage of points or'
      + ' the ×1.5 step: 1 point = 1 qirsh exactly, so the rate is already the'
      + " tier's NAME (2% / 4% / 6%) and a second copy of it goes stale the next"
      + ` time the ramp moves. Offending values: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });

  it('C4b the REDEMPTION rate is still stated, and matches config', () => {
    // Removing the earn rate must not take the redemption rate with it: 100
    // points = 1 JOD is what makes a points balance legible at all, and unlike
    // the earn rate it is not encoded in any tier name.
    const rate = String(config.POINTS_PER_JOD_REDEEM);
    for (const rel of Object.values(APP_LOCALES)) {
      const flat = load(rel);
      for (const key of ['rewards.step2Body', 'pay.redeemHint']) {
        expect(flat[key], `${rel} ${key} must state ${rate} points = 1 JOD`).toContain(rate);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// C5 — the tier name is DATA, and there is no second copy of it.
// ---------------------------------------------------------------------------
describe('C5 the tier name is read off the tier, never out of a locale file', () => {
  it('no `tiers` namespace exists in either app locale', () => {
    for (const rel of Object.values(APP_LOCALES)) {
      const raw = JSON.parse(readFileSync(join(REPO, rel), 'utf8')) as Record<string, unknown>;
      expect(
        raw.tiers,
        `${rel}: the tier name is Tier.nameAr / Tier.nameEn (packages/shared/src/`
        + 'loyalty/constants.ts). A locale copy of it is a second source of truth,'
        + ' and the last one held bean/silver/gold/black two commits after the ids'
        + ' became base/plus/top — rendering "tiers.base" on screen.',
      ).toBeUndefined();
    }
  });

  it('no source anywhere reaches for a `tiers.*` key', () => {
    const offenders: string[] = [];
    for (const f of sources) {
      f.code.forEach((line, i) => {
        if (/\bt\(\s*[`'"]tiers\./.test(line)) offenders.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
      });
    }
    expect(offenders, `use tierName(tier, lang). Offending lines: ${offenders.join(' | ')}`)
      .toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// C9 / C10 — the two copy rules that convention alone cannot hold.
// ---------------------------------------------------------------------------
describe('C9 the ×2 is said exactly once, on the promotion to the second rung', () => {
  it('exactly one key per app language carries it, and it is loyalty.toPlus', () => {
    for (const rel of Object.values(APP_LOCALES)) {
      const keys = Object.entries(load(rel)).filter(([, v]) => v.includes('×2')).map(([k]) => k);
      expect(
        keys,
        `${rel}: «المضاعف ×2 يُذكر مرة واحدة فقط — عند الترقية إلى 4%. تكراره`
        + ' يُفقده أثره». Selection runs through next.id in almond-app/lib/'
        + 'tierCopy.ts so this is structural, not editorial.',
      ).toEqual(['loyalty.toPlus']);
    }
  });

  it('the website, which has no promotion moment, never says it', () => {
    for (const rel of Object.values(WEB_LOCALES)) {
      const keys = Object.entries(load(rel)).filter(([, v]) => v.includes('×2')).map(([k]) => k);
      expect(keys, `${rel} carries no promotion copy`).toEqual([]);
    }
  });
});

describe('C10 Arabic copy uses Latin digits', () => {
  it('no Arabic-Indic digit appears in either Arabic file', () => {
    const offenders: string[] = [];
    for (const rel of [APP_LOCALES.ar, WEB_LOCALES.ar]) {
      for (const [k, v] of Object.entries(load(rel))) {
        if (/[٠-٩]/.test(v)) offenders.push(`${rel} ${k}: ${v}`);
      }
    }
    expect(
      offenders,
      'packages/shared/src/lib/format.ts formatNumber returns LATIN digits in'
      + ' both languages ("matches Jordanian commercial convention"), so every'
      + ' interpolated count arrives Latin whatever the literal around it does.'
      + ' An Arabic-Indic literal therefore mixes two numeral systems inside one'
      + ` sentence. Offending values: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// C11 — every key a call site asks for actually exists, in BOTH languages.
// ---------------------------------------------------------------------------
describe('C11 every i18n key the app asks for resolves in both languages', () => {
  const KEY = String.raw`[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+`;
  // `(?<![\w$.])` so `document.createElement('style')` is not read as a t() call.
  // A dotted key is required, which is what every locale key is.
  const T_CALL = new RegExp(String.raw`(?<![\w$.])t\(\s*['"\`](${KEY})['"\`]`, 'g');
  const KEY_PROP = new RegExp(String.raw`\b(?:labelKey|titleKey|bodyKey|key)\s*:\s*['"](${KEY})['"]`, 'g');

  /**
   * The three template forms that survive, enumerated over their FULL domains —
   * including `track.cancelled`, which the type permits even though
   * getActiveOrders() filters it out two files away. A dynamic key is exactly
   * what a static unused-key scan cannot see, which is how `tiers.*` survived.
   */
  const DYNAMIC = [
    'track.received', 'track.preparing', 'track.ready', 'track.completed', 'track.cancelled',
    'home.greetingMorning', 'home.greetingEvening',
    'home.greetingMorningGuest', 'home.greetingEveningGuest',
    // The promotion celebration. PromotionBanner.tsx renders `t(copy.key)` off
    // almond-app/lib/promotion.ts, so the key never appears as a literal at the
    // CALL site — the same dynamic shape that hid `tiers.*`. Enumerated here so
    // both-languages parity is enforced on them; C13 below enforces the other
    // direction (that each one has a render site at all).
    'loyalty.promotedDoubled', 'loyalty.promotedTop', 'loyalty.promotedNext',
  ];

  it('resolves', () => {
    const wanted = new Set<string>(DYNAMIC);
    for (const f of sources) {
      if (!f.path.startsWith('almond-app/')) continue;
      const code = f.code.join('\n');
      for (const m of code.matchAll(T_CALL)) wanted.add(m[1]);
      for (const m of code.matchAll(KEY_PROP)) wanted.add(m[1]);
    }
    // The scan must actually be finding call sites, or it proves nothing.
    expect(wanted.size).toBeGreaterThan(250);

    const en = load(APP_LOCALES.en);
    const ar = load(APP_LOCALES.ar);
    const missing = [...wanted]
      .filter((k) => !(k in en) || !(k in ar))
      .sort();
    expect(
      missing,
      'a key with no entry renders as its own name on screen — i18next returns'
      + ' the key, and fallbackLng cannot help when both files lack it.'
      + ` Unresolved keys: ${missing.join(', ')}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// C12 — one rewards board, two clients.
// ---------------------------------------------------------------------------
describe('C12 the website\'s rewards board is the app\'s board', () => {
  const WEB_BOARD = 'almond-web/src/data/loyalty.ts';

  it('almond-web derives its rungs from @almond/shared, never retypes them', () => {
    // The website kept a SECOND board — 100 / 180 / 250 / 300, offering "Free
    // drink" at 250 points. 250 points is 2.500 JOD, which covers 4 of the 69
    // priced drinks on the very menu this site serves (5.8%); almond-app calls
    // that same rung "Coffee or bakery" for exactly that reason and puts a real
    // handcrafted drink at 400 (97.1% coverage). The site's own copy says one
    // account across web and app, so those were one member's two contradictory
    // offers — and nothing could see it, because almond-web has no test suite
    // and the app's C7 only ever read the app's own array.
    //
    // Structural, in the style of T23a: the defect returns the moment someone
    // retypes a cost here, so the test bans the retyping rather than comparing
    // two lists that would then both be wrong.
    const src = readFileSync(join(REPO, WEB_BOARD), 'utf8');
    expect(
      src.includes("from '@almond/shared/loyalty/rewardRungs'"),
      `${WEB_BOARD} must build REWARDS from REWARD_RUNGS — the ladder is shared`
      + ' because the account is.',
    ).toBe(true);

    const code = src
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'));
    const retyped = code.filter((l) => /\bcost:\s*\d/.test(l));
    expect(
      retyped,
      `${WEB_BOARD}: a hard-coded reward cost. Costs come from REWARD_RUNGS.`
      + ` Offending lines: ${retyped.join(' | ')}`,
    ).toEqual([]);
  });

  it('the website states the max-value caveat, as the app does', () => {
    // Every rung is a CAP (1 point = 1 qirsh), so a member can be asked for the
    // difference at the till. The app has said so since W4; the website named
    // items and never mentioned the cap.
    for (const rel of Object.values(WEB_LOCALES)) {
      const hint = load(rel)['Rewards.maxValueHint'];
      expect(hint, `${rel}: Rewards.maxValueHint is missing`).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// C13 — the promotion celebration is WIRED, in both directions.
// ---------------------------------------------------------------------------
describe('C13 the promotion celebration reaches a screen', () => {
  const PREFIX = 'loyalty.promoted';
  const BANNER = 'almond-app/components/home/PromotionBanner.tsx';
  const HOME = 'almond-app/app/(tabs)/index.tsx';

  const promotedKeys = (rel: string): string[] =>
    Object.keys(load(rel)).filter((k) => k.startsWith(PREFIX)).sort();

  it('every celebration key exists in BOTH languages', () => {
    // C1 already forbids a one-sided key anywhere; this states it for the three
    // that matter here, because a missing one renders as "loyalty.promotedTop"
    // inside a 🎉 banner — the single most conspicuous place to print machine
    // text at a member.
    const en = promotedKeys(APP_LOCALES.en);
    expect(en.length, 'the celebration ships no keys at all').toBeGreaterThanOrEqual(3);
    expect(promotedKeys(APP_LOCALES.ar)).toEqual(en);
  });

  it('no celebration key is unwired, and no rendered key is missing', () => {
    // ⇄ BOTH DIRECTIONS. An unwired key is a sentence nobody is ever shown —
    // the exact state the celebration itself was in until this package (decided
    // copy, no surface: FINAL.md §4.5). A rendered key with no entry is
    // literal machine text on screen. Neither is visible to the other test.
    const app = sources.filter((f) => f.path.startsWith('almond-app/'));
    const literals = new Set<string>();
    for (const f of app) {
      for (const m of f.code.join('\n').matchAll(/['"`](loyalty\.promoted[A-Za-z0-9_]*)['"`]/g)) {
        literals.add(m[1]);
      }
    }
    const inLocale = promotedKeys(APP_LOCALES.en);
    expect(
      inLocale.filter((k) => !literals.has(k)),
      'a locale key no source names is a sentence no member can ever be shown',
    ).toEqual([]);
    expect(
      [...literals].filter((k) => !inLocale.includes(k)).sort(),
      'a key the code asks for with no entry renders as its own name',
    ).toEqual([]);
  });

  it('the banner is mounted on the screen the app opens on', () => {
    // Without this, all three keys could be "reached" from a module nothing
    // renders and every assertion above would still pass. The promotion happens
    // at a till and the member may not open the app for days, so the surface
    // has to be one they land on, not one they navigate to.
    const banner = sources.find((f) => f.path === BANNER);
    const home = sources.find((f) => f.path === HOME);
    expect(banner, `${BANNER} must exist`).toBeTruthy();
    expect(home, `${HOME} must exist`).toBeTruthy();

    const homeCode = home!.code.join('\n');
    expect(homeCode, `${HOME} must render <PromotionBanner />`).toContain('<PromotionBanner');
    expect(homeCode).toMatch(/from '@\/components\/home\/PromotionBanner'/);

    const bannerCode = banner!.code.join('\n');
    // It must decide the sentence through the one module that owns the rule,
    // and it must actually translate it.
    expect(bannerCode).toContain('promotionCopy(');
    expect(bannerCode).toMatch(/t\(\s*copy\.key/);
    expect(bannerCode).toMatch(/t\(\s*copy\.next\.key/);
    // ... and it must be the OBSERVER, or the record never advances and the
    // celebration is never detected in the first place.
    expect(bannerCode).toMatch(/observe\(/);
    // ... and it must observe AGAIN once the disk has been read.
    // `promotionStore.observe()` refuses to record anything before hydration —
    // that gate is what stops a cold-start race from baselining over a real
    // record. But a gate that is only ever hit once is a mute button: on a cold
    // start the balance query routinely resolves before AsyncStorage does, so
    // if `hydrated` is not in the effect's dependency list the single refused
    // observation is the only one ever attempted, and the celebration is
    // swallowed on exactly the launch that should have shown it. Silently, and
    // with every pure test in almond-app/test/promotion.test.ts still green,
    // because those call observe() themselves.
    expect(
      bannerCode,
      'PromotionBanner must re-observe when the store finishes hydrating',
    ).toMatch(/hydrated\]\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// C14 — THE COMBO OFFER: on a surface, and stating the dial rather than a copy
// of it.
// ---------------------------------------------------------------------------
describe('C14 the combo offer is surfaced, and its count comes from the dial', () => {
  const CARD = 'almond-app/components/home/ComboOfferCard.tsx';
  const OFFERS = 'almond-app/components/home/PromoCarousel.tsx';
  const HOME = 'almond-app/app/(tabs)/index.tsx';
  const DECIDER = 'almond-app/lib/comboOffer.ts';

  const comboKeys = (rel: string): string[] =>
    Object.keys(load(rel)).filter((k) => /^(offers|cart)\.combo/.test(k)).sort();

  it('C14a every combo string interpolates the count and states no number', () => {
    /**
     * 🔴 THE DEFECT THIS IS BUILT ON, twice over.
     *
     * `config.COMBO_BONUS_POINTS` went 50 → 25 → 50. Through all of it two
     * surfaces stated "50" as a literal:
     *   - the cart banner's label, so for two days the app promised twice what
     *     the server granted, in both languages, with the whole suite green;
     *   - the offers-page tile in PromoCarousel.tsx, as a hardcoded bilingual
     *     string («مشروب + طعام = 50 نقطة» / "Drink + food = 50 points") —
     *     which C4 above could never have seen, because C4 reads locale files
     *     and that number was in a .tsx.
     *
     * The rule is stronger than "the number must be right": a combo value may
     * contain NO DIGIT AT ALL, so the count can only ever arrive interpolated
     * and there is nothing left to go stale.
     */
    const offenders: string[] = [];
    for (const rel of Object.values(APP_LOCALES)) {
      const flat = load(rel);
      const keys = comboKeys(rel);
      expect(keys.length, `${rel}: no combo copy at all`).toBeGreaterThanOrEqual(6);
      for (const k of keys) {
        const v = flat[k];
        if (/[0-9]/.test(v)) offenders.push(`${rel} ${k} states a literal number: ${v}`);
        // Only the strings that actually mention points must interpolate one;
        // `cart.addCombo` ("Add & earn") and `offers.comboCta` state none.
        if (/points|نقطة|نقاط/.test(v) && !v.includes('{{points}}')) {
          offenders.push(`${rel} ${k} mentions points without {{points}}: ${v}`);
        }
      }
    }
    expect(
      offenders,
      'the combo count is config.COMBO_BONUS_POINTS and lives in exactly one'
      + ` place. Offending values: ${offenders.join(' | ')}`,
    ).toEqual([]);
    // Both languages carry the same combo keys (C1 says it for every key; said
    // here too because a one-sided combo key renders "offers.comboTitle" as the
    // headline of the offer this package exists to make findable).
    expect(comboKeys(APP_LOCALES.ar)).toEqual(comboKeys(APP_LOCALES.en));
  });

  it('C14b no source hands a locale string a hard-coded points count', () => {
    // The interpolation side of the same rule. A value with no digit is still
    // wrong if the CALLER writes `{ points: 50 }`, and that call site is
    // exactly what the cart banner used to be.
    //
    // Anchored on the TRANSLATION call, in the idiom T7c uses: a `points:`
    // number is only a copy defect when it is being interpolated into a
    // sentence. A seeded member BALANCE (`points: 1240` in the mock's demo user,
    // `points: 240` in the website's store) is a quantity, not a claim, and
    // banning it would be a rule about the wrong thing.
    const ANCHOR = /\bt\(\s*['"`]|\bparams\s*:\s*\{/;
    const offenders: string[] = [];
    for (const f of sources) {
      if (!f.path.startsWith('almond-app/') && !f.path.startsWith('almond-web/')) continue;
      f.code.forEach((line, i) => {
        if (!ANCHOR.test(line)) return;
        // The params object rarely survives past a handful of lines; 5 covers
        // every multi-line t() call in the app today.
        const callSite = f.code.slice(i, i + 5).join('\n');
        if (/\bpoints\s*:\s*\d/.test(callSite)) offenders.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
      });
    }
    expect(
      offenders,
      'a points count must be read from config, never written at a call site.'
      + ` Offending lines: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });

  it('C14c no source literal states a percentage of points', () => {
    /**
     * C4 forbids this in the four locale files. It was ALSO true of three
     * hardcoded bilingual strings that no locale test could reach, and all
     * three outlived the mechanics they promised:
     *   - PromoCarousel's `friday` tile, "+50% points every Friday" —
     *     WEEKDAY_EARN_BONUS is `[]` and BONUS_BEAN_DAY.enabled is false, both
     *     retired 2026-09-06. The same promise W4 deleted from the locales as
     *     `tierBenefits.doubleDays4/6`.
     *   - PromoCarousel's `wallet` tile, "earn +50% points".
     *   - app/profile/wallet.tsx, «الدفع من رصيدك يكسبك +50% نقاط (×1.5)».
     *     Both are WALLET_EARN_MULTIPLIER, retired to 1.0 after ZERO rows in
     *     171,291 live transactions — so the claim paid nothing, on three
     *     screens, through the copy repair that removed it everywhere else.
     *
     * Two of C4's own patterns, applied to source lines rather than locale
     * values. A mock notification stating a PAST grant ("You earned 15 points
     * on your last order") is not a percentage and is deliberately untouched.
     */
    const PATTERNS: { name: string; re: RegExp }[] = [
      { name: 'percent-points', re: /\d+(\.\d+)?\s*%[^\n]{0,16}(more\s+)?(points|نقاط|نقطة)/ },
      { name: 'points-percent', re: /(points|نقاط|نقطة)[^\n]{0,16}[+±]\s*\d+(\.\d+)?\s*%/ },
      { name: 'points-multiplier', re: /(points|نقاط|نقطة)[^\n]{0,8}\(\s*×\s*\d/ },
    ];
    const offenders: string[] = [];
    for (const f of sources) {
      if (!f.path.startsWith('almond-app/') && !f.path.startsWith('almond-web/')) continue;
      f.code.forEach((line, i) => {
        for (const p of PATTERNS) {
          if (p.re.test(line)) offenders.push(`${f.path}:${i + 1} [${p.name}]: ${f.raw[i].trim()}`);
        }
      });
    }
    expect(
      offenders,
      'a rate stated in a .tsx is a rate no locale test can see. 1 point = 1'
      + ' qirsh exactly, so the rate is already the rung\'s NAME, and the wallet'
      + ' and weekday multipliers that these strings promised are retired.'
      + ` Offending lines: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });

  it('C14d the offer reaches the offers page, from the dial', () => {
    // ⇄ THE WIRING, in the shape C13 uses. Everything above can be green while
    // the card is a module nothing renders — which is exactly the state the
    // combo was in on the offers page: present in the cart, absent anywhere a
    // member without a basket could find it.
    const find = (rel: string) => sources.find((f) => f.path === rel);
    for (const rel of [CARD, OFFERS, HOME, DECIDER]) {
      expect(find(rel), `${rel} must exist`).toBeTruthy();
    }
    const card = find(CARD)!.code.join('\n');
    const offers = find(OFFERS)!.code.join('\n');
    const home = find(HOME)!.code.join('\n');

    // The card decides through the one module that owns the rule, reads the
    // count off the dial, and suggests through the SHARED pairing engine (not a
    // second one that happens to agree).
    expect(card, `${CARD} must decide through comboOfferCopy()`).toContain('comboOfferCopy(');
    expect(card, `${CARD} must read the count from config`).toContain('config.COMBO_BONUS_POINTS');
    expect(card, `${CARD} must pair through @almond/shared`).toContain('getComboStarter(');
    expect(card).toMatch(/t\(\s*copy\.titleKey/);
    expect(card).toMatch(/t\(\s*copy\.bodyKey/);

    // ... and it is mounted on the offers surface, which is mounted on Home.
    expect(offers, `${OFFERS} must render <ComboOfferCard />`).toContain('<ComboOfferCard');
    expect(offers).toMatch(/from '@\/components\/home\/ComboOfferCard'/);
    expect(home, `${HOME} must render <PromoCarousel />`).toContain('<PromoCarousel');

    // The offers surface carries no bilingual string literals any more. All
    // three of its tiles were `titleAr` / `titleEn` pairs, which is how a
    // config number and two retired mechanics lived there unseen.
    expect(
      /\btitle(Ar|En)\s*:/.test(offers),
      `${OFFERS}: offer copy is a locale key in both languages, never a pair of`
      + ' string literals — a literal is invisible to every test in this file.',
    ).toBe(false);
  });
});
