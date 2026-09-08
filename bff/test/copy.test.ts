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
