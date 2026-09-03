import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { config } from '@almond/shared/config';
import {
  computeEarn, earnedPoints, earnRulesFromConfig, type EarnRules,
} from '@almond/shared/loyalty/earn';
import { ammanWeekday } from '@almond/shared/lib/ammanWeekday';
import { computeTotals } from '@almond/shared/cart';
import { comboPairs } from '@almond/shared/lib/combo';
import { menuItems } from '@almond/shared/menu';
import type { CartItem } from '@almond/shared/types';
import * as bffEarn from '../src/earn';
import { reprice } from '../src/pricing';
import { build } from '../src/server';

/**
 * §7 of docs/LOYALTY-EARN-PATCH.md: T1-T10, T12 and T14. T11, T13 and T15 need
 * the app's own module resolution and live in almond-app/test/.
 *
 * READ THIS BEFORE CHANGING A NUMBER IN HERE.
 * D4 — moving the combo bonus INSIDE the ceiling — is an OFFER CHANGE gated on
 * §8.7 and is deliberately NOT shipped (see packages/shared/src/loyalty/earn.ts,
 * the comment above the ceiling). The combo is therefore still added AFTER the
 * cap, exactly as the pre-patch bff/src/earn.ts:21 did. T5, T5b and T6 are
 * written against THAT — the shipped semantics — and not against §7's literal
 * text, which assumes D4 is in. Each of the three says what it becomes when
 * §8.7 is decided. If a change to earn.ts makes them red, the change moved
 * money: gate it, do not edit the expectations.
 */

const MON = new Date('2026-09-07T10:00:00Z'); // Monday in Amman
const FRI = new Date('2026-09-11T10:00:00Z'); // Friday in Amman
const TUE = new Date('2026-09-08T10:00:00Z'); // Tuesday (BONUS_BEAN_DAY weekday)

/** Every dial the assertions below depend on, pinned as literals. A config
 *  edit changes exactly one test (the first), not the meaning of all of them. */
const RULES: EarnRules = {
  pointsPerJod: 5,
  walletMultiplier: 1.5,
  maxEarnMultiplier: 5,
  comboBonusPoints: 50,
  weekdayBonus: [{ weekday: 5, rate: 0.5 }],
  bonusDay: { enabled: true, multiplier: 2, weekdays: [2] },
};

function cartLine(itemId: string, unitBasePrice: number, qty: number, isDrink: boolean): CartItem {
  return {
    lineId: `${itemId}__M`, itemId, nameAr: '', nameEn: '', emoji: '',
    sizeId: 'M', sizeNameAr: '', sizeNameEn: '',
    unitBasePrice, customizations: [], qty, isDrink,
  };
}

describe('earn: the dials the tests are written against', () => {
  it('earn: earnRulesFromConfig() still matches the pinned rule set', () => {
    // If this fails, a config value moved. Decide whether that was an offer
    // change (§8) before touching any other expectation in this file.
    expect(earnRulesFromConfig()).toEqual(RULES);
  });
});

describe('earn: the arithmetic (T1-T4)', () => {
  it('T1 earn: base rate is 5 points per JOD (1 point = 1 qirsh)', () => {
    expect(computeEarn({ total: 10, at: MON }, RULES).points).toBe(50);
  });

  it('T2 earn: paying from the wallet adds +50% of base', () => {
    expect(computeEarn({ total: 10, paidFromBalance: true, at: MON }, RULES).points).toBe(75);
  });

  it('T3 earn: the tier multiplier comes from rolling-window spend', () => {
    const black = computeEarn({ total: 10, windowSpend: 750, at: MON }, RULES);
    expect(black.tierId).toBe('black');
    expect(black.points).toBe(100);
    expect(computeEarn({ total: 10, windowSpend: 99, at: MON }, RULES).tierId).toBe('bean');
  });

  it('T4 earn: the weekday bonus is read from config, not from getDay()', () => {
    // This is the test that would have made D3 impossible.
    const off: EarnRules = { ...RULES, weekdayBonus: [] };
    expect(computeEarn({ total: 10, at: FRI }, off).points).toBe(50);

    const on: EarnRules = { ...RULES, weekdayBonus: [{ weekday: 5, rate: 0.5 }] };
    expect(computeEarn({ total: 10, at: FRI }, on).points).toBe(75);
    expect(computeEarn({ total: 10, at: MON }, on).points).toBe(50);
  });

  it('earn: earnedPoints() is computeEarn().points and nothing else', () => {
    const ctx = { total: 7.2, windowSpend: 300, paidFromBalance: true, comboPairs: 2, at: FRI };
    expect(earnedPoints(ctx, RULES)).toBe(computeEarn(ctx, RULES).points);
  });
});

describe('earn: the ceiling (D1) and where the combo sits (D4) — T5, T5b', () => {
  it('T5 earn: the combo bonus and the cap on the priced-pair basket', () => {
    // §4 D4 secondary example, priced through computeTotals so the tax basis
    // (§1.1) cannot drift: a 17.50 subtotal is a 20.30 INVOICE.
    const cart = [
      cartLine('mineral-water', 0.75, 10, true),
      cartLine('cake-pop', 1.0, 10, false),
    ];
    expect(computeTotals(cart, 0).total).toBeCloseTo(20.3, 6);
    expect(comboPairs(cart)).toBe(10);

    const r = computeEarn({ total: 20.3, comboPairs: 10, at: MON }, RULES);
    expect(r.comboBonus).toBe(500);
    expect(r.subtotal).toBeCloseTo(601.5, 6);
    expect(r.cap).toBeCloseTo(507.5, 6);

    // SHIPPED SEMANTICS (D4 not in — §8.7). The combo is added after the
    // ceiling, so the grant is 602 — bit-identical to the pre-patch server.
    expect(r.points).toBe(602);
    // ... and the ceiling is not what limits it: the sum is over the cap, but
    // only the non-combo part is trimmed (here: nothing to trim).
    expect(r.subtotal).toBeGreaterThan(r.cap);
    expect(r.capApplied).toBe(false);
    expect(r.points).toBeGreaterThan(r.cap);
    // WHEN §8.7 SHIPS D4 this becomes: capApplied true, points 508.
  });

  it('T5b earn: a zero-priced food item still mints uncapped combo points (§2.1, §8.7)', () => {
    // §4 D4 primary example: 10 x mineral water + 10 x a ZERO-priced Mother's
    // Day cake ⇒ subtotal 7.50, invoice 8.70.
    const cart = [
      cartLine('mineral-water', 0.75, 10, true),
      cartLine('mother-s-day-coffee-cake', 0, 10, false),
    ];
    expect(computeTotals(cart, 0).total).toBeCloseTo(8.7, 6);
    expect(comboPairs(cart)).toBe(10);

    const r = computeEarn({ total: 8.7, comboPairs: 10, at: MON }, RULES);
    expect(r.comboBonus).toBe(500);
    expect(r.points).toBe(544);
    // 5.440 JOD of points on an 8.700 JOD invoice = 62.5% of the invoice.
    expect(r.points / config.POINTS_PER_JOD_REDEEM / r.total).toBeCloseTo(0.625, 3);

    // Assert against r.cap, never a hand-computed literal. §7 T5b predicts 217
    // because it evaluates `8.7 * 25`, which IS 217.49999999999997 in IEEE-754.
    // computeEarn does not associate it that way: base = 8.7 * 5 = 43.5 (exact
    // in binary), then cap = 43.5 * 5 = 217.5 (exact), which rounds to 218. The
    // spec's own instruction is what saves it; its literal is what would not.
    expect(8.7 * 25).toBe(217.49999999999997);
    expect(r.cap).toBe(217.5);
    expect(Math.round(r.cap)).toBe(218);
    // THE EXPOSURE, stated as an assertion so it cannot be forgotten: the flat
    // 50-points-per-pair combo is outside the ceiling by 326 points here.
    expect(r.points - Math.round(r.cap)).toBe(326);
    // WHEN §8.7 SHIPS D4 this becomes: capApplied true, points === Math.round(r.cap).
  });

  it('D1 earn: the ceiling is LIVE — it binds on an activated bonus day', () => {
    // The reachable stack on a bonus day is wallet 1.5 x bonus-day 2 x
    // (1 + (tier 2.0 - 1)) = 6x base, so the 5x ceiling trims the grant. This
    // is what makes MAX_EARN_MULTIPLIER stop being dead code (D1).
    const r = computeEarn(
      { total: 7.2, windowSpend: 750, paidFromBalance: true, bonusDayActivated: true, at: TUE },
      RULES,
    );
    expect(r.base).toBeCloseTo(36, 6);
    expect(r.cap).toBeCloseTo(180, 6);
    expect(r.subtotal).toBeCloseTo(216, 6);
    expect(r.capApplied).toBe(true);
    expect(r.points).toBe(180);
    expect(r.effectiveMultiplier).toBeCloseTo(5, 9);
  });

  it('D1 earn: with the bonus day off the reachable stack is 3.75x and the cap does not bind', () => {
    // §8.2: wallet 1.5 x (1 + (tier 2.0 - 1) + Friday 0.5) = 3.75x.
    const r = computeEarn(
      { total: 7.2, windowSpend: 750, paidFromBalance: true, at: FRI },
      RULES,
    );
    expect(r.capApplied).toBe(false);
    expect(r.points).toBe(135);
    expect(r.effectiveMultiplier).toBeCloseTo(3.75, 9);
  });

  it('D2 earn: bonusDayActivated defaults to false — no caller can assert it into the grant', () => {
    const claimed = computeEarn({ total: 10, at: TUE }, RULES);
    expect(claimed.bonusDayBonus).toBe(0);
    expect(claimed.points).toBe(50);
    // It is paid ONLY when the caller passes the server-verified flag.
    expect(computeEarn({ total: 10, bonusDayActivated: true, at: TUE }, RULES).points).toBe(100);
  });
});

describe('T6 earn: total giveback ceiling — no input can exceed MAX_EARN_MULTIPLIER x base', () => {
  // THIS IS THE GIVEBACK-CEILING TEST.
  const TOTALS = [0, 0.75, 1.75, 7.2, 8.7, 20.3, 50];
  const WINDOW_SPEND = [0, 100, 300, 750];
  const PAIRS = [0, 1, 5, 25];
  // 2026-09-06 is a Sunday in Amman; seven consecutive days = weekday 0..6.
  const DAYS = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2026, 8, 6 + i, 10, 0, 0)));

  it('the seven grid days really are Amman weekday 0..6', () => {
    expect(DAYS.map((d) => ammanWeekday(d))).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('the capped component of every grant is bounded by the ceiling', () => {
    let sawCapBind = false;
    let sawComboEscape = false;

    for (const total of TOTALS) {
      for (const windowSpend of WINDOW_SPEND) {
        for (const paidFromBalance of [false, true]) {
          for (const bonusDayActivated of [false, true]) {
            for (const pairs of PAIRS) {
              for (const at of DAYS) {
                const r = computeEarn(
                  { total, windowSpend, paidFromBalance, bonusDayActivated, comboPairs: pairs, at },
                  RULES,
                );
                const where = JSON.stringify({
                  total, windowSpend, paidFromBalance, bonusDayActivated,
                  pairs, weekday: r.weekday,
                });

                // The combo is a flat, per-pair grant that sits OUTSIDE the
                // ceiling (D4 is gated on §8.7). Everything else is inside it.
                const capped = r.points - r.comboBonus;
                expect(r.comboBonus, where).toBe(pairs * RULES.comboBonusPoints);

                // r.cap IS base x maxEarnMultiplier, computed once inside the
                // function under test — no re-derivation here. Math.round
                // because `points` is whole points and `cap` is not.
                expect(capped, where).toBeLessThanOrEqual(Math.round(r.cap));

                // The total bound on what may ever be granted, for any input.
                expect(r.points, where).toBeLessThanOrEqual(Math.round(r.cap) + r.comboBonus);

                if (total > 0) {
                  // The ratio form. The tolerance is 0.5/base, not 1e-9: the
                  // grant is rounded to whole points while the ceiling is not,
                  // so at total = 0.75 (base 3.75, cap 18.75) a capped grant of
                  // 19 points is 5.067x base and is still the ceiling working.
                  const slack = 0.5 / r.base + 1e-9;
                  expect(capped / r.base, where)
                    .toBeLessThanOrEqual(RULES.maxEarnMultiplier + slack);
                  expect(r.effectiveMultiplier, where).toBe(r.points / r.base);
                } else {
                  expect(r.effectiveMultiplier, where).toBe(0);
                  expect(r.points, where).toBe(pairs * RULES.comboBonusPoints);
                }

                if (r.capApplied) sawCapBind = true;
                if (r.points > Math.round(r.cap)) {
                  sawComboEscape = true;
                  // The ONLY way past the ceiling is the combo (§8.7).
                  expect(pairs, where).toBeGreaterThan(0);
                }
              }
            }
          }
        }
      }
    }

    // The grid must actually exercise both edges, or it proves nothing.
    expect(sawCapBind).toBe(true);
    expect(sawComboEscape).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T7 / T8 — the static walk over every workspace.
// ---------------------------------------------------------------------------

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOTS = ['almond-app', 'almond-web', 'bff', 'packages'];
const SKIP_DIRS = new Set([
  'node_modules', '.expo', '.next', 'dist', 'build', 'coverage', '.git',
  'test', '__tests__', '.turbo',
]);

interface SourceFile {
  /** Repo-relative, POSIX separators. */
  path: string;
  raw: string[];
  /** Same lines with comments blanked out — see stripComments(). */
  code: string[];
}

/**
 * Comments are blanked, not matched. T7 and T8 are about CODE: a line that
 * merely NAMES `COMBO_BONUS_POINTS` or `getDay() === 5` while explaining why it
 * must not be used is not an offender, and four such lines exist today (this
 * file's own header among them). §9's checklist grep is a plain grep and does
 * hit them, which is why the checklist and the test disagree there — the test
 * is the authority (§9's own scope note) and this is the reading that makes
 * §9's stated expected result true.
 */
function stripComments(lines: string[]): string[] {
  let inBlock = false;
  return lines.map((line) => {
    let out = '';
    for (let i = 0; i < line.length; i++) {
      if (inBlock) {
        if (line[i] === '*' && line[i + 1] === '/') { inBlock = false; i++; }
        continue;
      }
      if (line[i] === '/' && line[i + 1] === '*') { inBlock = true; i++; continue; }
      if (line[i] === '/' && line[i + 1] === '/') break; // rest of the line
      out += line[i];
    }
    return out;
  });
}

function collectSources(): SourceFile[] {
  const out: SourceFile[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (!SKIP_DIRS.has(entry)) walk(full);
      } else if (/\.tsx?$/.test(entry)) {
        const raw = readFileSync(full, 'utf8').split('\n');
        out.push({
          path: relative(REPO, full).split(sep).join('/'),
          raw,
          code: stripComments(raw),
        });
      }
    }
  };
  for (const root of ROOTS) walk(join(REPO, root));
  return out;
}

let sources: SourceFile[];
beforeAll(() => { sources = collectSources(); });

const EXEMPT_MARKER = /\/\/\s*earn-arith-exempt:/;
/** Exemption is per LINE: the line itself, or the line directly above it. */
function isExempt(f: SourceFile, i: number): boolean {
  return EXEMPT_MARKER.test(f.raw[i]) || (i > 0 && EXEMPT_MARKER.test(f.raw[i - 1]));
}

describe('T7 earn: no module outside @almond/shared/loyalty/earn computes points', () => {
  // THIS IS THE ANTI-DIVERGENCE TEST. D2 existed because the earn arithmetic
  // was written twice. It cannot come back while every constant it needs is
  // unreachable outside the one implementation.
  const WHOLESALE_EXEMPT = new Set([
    'packages/shared/src/config/index.ts',   // the declarations
    'packages/shared/src/loyalty/earn.ts',   // the one implementation
  ]);

  const PATTERNS: { re: RegExp; sharedIsExempt: boolean }[] = [
    { re: /\bPOINTS_PER_JOD\b(?!_REDEEM)/, sharedIsExempt: false },
    { re: /\bMAX_EARN_MULTIPLIER\b/, sharedIsExempt: false },
    { re: /\bWALLET_EARN_MULTIPLIER\b/, sharedIsExempt: false },
    { re: /\bCOMBO_BONUS_POINTS\b/, sharedIsExempt: false },
    { re: /\bcomboBonusPoints\s*\(/, sharedIsExempt: false },
    // The tier ramp is legitimate for DISPLAY everywhere; what must not spread
    // is deriving an earn multiplier from it outside the shared function.
    { re: /\btierFromSpend\b/, sharedIsExempt: true },
  ];

  it('every earn constant outside the shared implementation is exempted by line', () => {
    const offenders: string[] = [];
    for (const f of sources) {
      if (WHOLESALE_EXEMPT.has(f.path)) continue;
      const inShared = f.path.startsWith('packages/shared/');
      f.code.forEach((line, i) => {
        for (const p of PATTERNS) {
          if (p.sharedIsExempt && inShared) continue;
          if (p.re.test(line) && !isExempt(f, i)) {
            offenders.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
            return;
          }
        }
      });
    }
    expect(
      offenders,
      'earn arithmetic must live in packages/shared/src/loyalty/earn.ts — see '
      + `docs/LOYALTY-EARN-PATCH.md §3. Offending lines: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });

  it('T7b the BFF earn module IS the shared function, not a copy of it', () => {
    // Identity, not equal numbers: two implementations that agree today are
    // exactly the state D2 was in. bff/src/earn.ts must be a re-export.
    expect(bffEarn.computeEarn).toBe(computeEarn);
    expect(bffEarn.earnedPoints).toBe(earnedPoints);
    expect(bffEarn.earnRulesFromConfig).toBe(earnRulesFromConfig);
    // ... and the file itself is a re-export: no operator, no Math, no body.
    const src = stripComments(readFileSync(join(REPO, 'bff/src/earn.ts'), 'utf8').split('\n'))
      .join('\n');
    expect(src).not.toMatch(/Math\./);
    expect(src).not.toMatch(/[+\-*/]\s|\breturn\b|\bfunction\b|=>/);
  });

  it('the walk actually looked at the files it claims to guard', () => {
    // A walk that silently found nothing would pass every assertion above.
    const paths = new Set(sources.map((f) => f.path));
    expect(paths.has('almond-app/services/loyalty.service.mock.ts')).toBe(true);
    expect(paths.has('almond-web/src/data/order.ts')).toBe(true);
    expect(paths.has('bff/src/routes/checkout.ts')).toBe(true);
    expect(paths.has('packages/shared/src/loyalty/earn.ts')).toBe(true);
    expect(sources.length).toBeGreaterThan(100);
  });
});

describe('T8 earn: the Friday literal is gone from every codebase', () => {
  it('no code anywhere still hardcodes getDay() === 5 (D3)', () => {
    const hits: string[] = [];
    for (const f of sources) {
      f.code.forEach((line, i) => {
        if (/getDay\(\)\s*===\s*5/.test(line)) hits.push(`${f.path}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('no code reads a business day off a freshly-constructed host clock (§3.6)', () => {
    const hits: string[] = [];
    for (const f of sources) {
      if (f.path === 'packages/shared/src/lib/ammanWeekday.ts') continue;
      f.code.forEach((line, i) => {
        if (/\bnew Date\([^)]*\)\.getDay\(\)/.test(line)) hits.push(`${f.path}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('the remaining host-clock weekday reads are the known, enumerated ones', () => {
    // A ratchet, not a blessing. §3.6 names the sites ammanWeekday replaces and
    // almond-app/lib/bonusDay.ts is NOT among them, so no work unit has closed
    // it; it still gates the ×2 banner off the device clock. This assertion
    // exists so a NEW host-clock read cannot be added silently, and so the
    // remaining one is visible. §9's checklist item 2 is not satisfied until
    // this list is empty.
    const KNOWN_OPEN = ['almond-app/lib/bonusDay.ts'];
    const hits: string[] = [];
    for (const f of sources) {
      if (f.path === 'packages/shared/src/lib/ammanWeekday.ts') continue;
      f.code.forEach((line, i) => {
        if (/\.getDay\(\)/.test(line)) hits.push(`${f.path}:${i + 1}`);
      });
    }
    expect(hits.map((h) => h.split(':')[0])).toEqual(KNOWN_OPEN);
  });
});

describe('T14 earn: client and server agree across the Thursday/Friday boundary (§3.6)', () => {
  // THIS IS THE TEST THAT STOPS D2 COMING BACK THROUGH THE CLOCK.
  const BOUNDARY: { iso: string; ammanWeekday: number }[] = [
    { iso: '2026-09-10T19:30:00Z', ammanWeekday: 4 }, // 22:30 Amman, Thursday
    { iso: '2026-09-10T21:30:00Z', ammanWeekday: 5 }, // 00:30 Amman, Friday
    { iso: '2026-09-10T23:30:00Z', ammanWeekday: 5 }, // 02:30 Amman, Friday
    { iso: '2026-09-11T00:30:00Z', ammanWeekday: 5 }, // 03:30 Amman, Friday
  ];

  const originalTZ = process.env.TZ;
  afterAll(() => { process.env.TZ = originalTZ; });

  it('the Amman weekday is the same on a UTC host and on an Amman host', () => {
    for (const { iso, ammanWeekday: expected } of BOUNDARY) {
      const at = new Date(iso);
      process.env.TZ = 'UTC';
      const utcRun = ammanWeekday(at);
      const utcHostDay = new Date(iso).getDay();
      process.env.TZ = 'Asia/Amman';
      const ammanRun = ammanWeekday(at);
      const ammanHostDay = new Date(iso).getDay();

      expect(utcRun, iso).toBe(expected);
      expect(ammanRun, iso).toBe(expected);
      // ... and the host clock genuinely disagrees with itself here, which is
      // what makes this test capable of failing if the implementation ever
      // regresses to Date#getDay().
      expect(ammanHostDay, iso).toBe(expected);
      if (iso === '2026-09-10T21:30:00Z' || iso === '2026-09-10T23:30:00Z') {
        expect(utcHostDay, iso).toBe(4); // the host would say Thursday
        expect(utcHostDay).not.toBe(expected);
      }
    }
  });

  it('the grant is the same on a UTC host and on an Amman host', () => {
    for (const { iso, ammanWeekday: wd } of BOUNDARY) {
      const at = new Date(iso);
      process.env.TZ = 'UTC';
      const onUtc = computeEarn({ total: 7.2, at }, RULES).points;
      process.env.TZ = 'Asia/Amman';
      const onAmman = computeEarn({ total: 7.2, at }, RULES).points;
      expect(onUtc, iso).toBe(onAmman);
      // 7.2 x 5 = 36 base; Friday pays +50% ⇒ 54. The 00:30-03:30 Amman window
      // is the one where a host-clock server would have paid 36 and the phone
      // would have promised 54 — the D2 failure mode on the D3 dial.
      expect(onUtc, iso).toBe(wd === 5 ? 54 : 36);
    }
  });
});

describe('T10 checkout: the points the route grants equal computeEarn on the same inputs', () => {
  let app: FastifyInstance;
  let token: string;
  const line = (() => {
    const item = menuItems.find(
      (m) => m.inStock !== false && m.sizes.length > 0 && m.sizes[0].price > 0,
    )!;
    return { itemId: item.id, sizeId: item.sizes[0].id, optionIds: [], qty: 1 };
  })();

  beforeAll(async () => {
    app = await build();
    await app.inject({ method: 'POST', url: '/v1/auth/otp/request', payload: { phone: '0790000000' } });
    const v = await app.inject({
      method: 'POST', url: '/v1/auth/otp/verify',
      payload: { phone: '0790000000', code: '123456' },
    });
    token = v.json().token;
  });

  it('grants exactly computeEarn({ total, windowSpend, paidFromBalance, comboPairs }).points', async () => {
    // A single line is one kind of item, so it can never make a pair. Pinned,
    // because the route feeds comboPairs into the grant.
    expect(reprice([line]).comboPairs).toBe(0);

    const auth = { authorization: `Bearer ${token}` };
    const before = (await app.inject({ method: 'GET', url: '/v1/me/balance', headers: auth })).json();

    const r = await app.inject({
      method: 'POST', url: '/v1/checkout',
      payload: { branchId: 'b1', orderType: 'pickup', paymentMethod: 'wallet', lines: [line] },
      headers: { ...auth, 'idempotency-key': randomUUID() },
    });
    expect(r.statusCode).toBe(201);
    const body = r.json();

    // body.total is the TAX-INCLUSIVE total (§1.1). Asserting against
    // body.subtotal is the bug this test exists to catch.
    const expected = computeEarn({
      total: body.total,
      windowSpend: before.windowSpend,
      paidFromBalance: true,
      comboPairs: 0,
      at: new Date(),
    }).points;

    expect(body.pointsEarned).toBe(expected);
    expect(body.pointsEarned).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(body.subtotal); // tax really is in there
  });
});

// ---------------------------------------------------------------------------
// Held behind a product decision — written, named, and not run.
// ---------------------------------------------------------------------------

/** §4 D6 prize values, in JOD, at repo menu prices. Checked in so the EV in
 *  the patch document and the EV the test computes can never drift apart. */
const PRIZE_VALUES_JOD: Record<string, number> = {
  'credit-1': 1.0, cookie: 1.9, americano: 2.5, 'any-drink': 4.5,
  'omelette-croissant': 2.9, pasta: 4.5, pizza: 7.5, 'credit-5': 5.0,
  cake: 4.5, 'credit-10': 10.0, 'no-win': 0,
};
/** The ceiling §8.4 must choose. Today the wheel pays 2.583 JOD/spin at a 100%
 *  win probability; there is no agreed ceiling, so the test cannot run. */
const SPIN_EV_CEILING_JOD: number | null = null;

describe('held behind §8', () => {
  it.todo(
    'T9 spin: the wheel has a losing slot and a bounded EV (D6, §8.4)'
    + ` — needs SPIN_EV_CEILING_JOD (currently ${SPIN_EV_CEILING_JOD})`
    + ` over ${Object.keys(PRIZE_VALUES_JOD).length} prize values;`
    + ' assert computeOdds(defaultSpinPrizes)["no-win"] > 0 and'
    + ' computeSpinEV(defaultSpinPrizes, PRIZE_VALUES_JOD) <= SPIN_EV_CEILING_JOD.'
    + ' NOTE: spinDefaults.ts resolves through the app\'s `@/` alias, so when'
    + ' §8.4 lands this test runs from almond-app/test/, or computeSpinEV moves'
    + ' to @almond/shared.',
  );

  it.todo(
    'T12 subscription: the monthly cap binds before the daily cap runs out (D7, §8.5)'
    + ' — needs config.SUBSCRIPTION.drinksPerMonth, which §8.5 has not set'
    + ' (the field does not exist yet). With drinksPerMonth: 20, redeem 20'
    + ' drinks across 10 days (2/day), then the 21st POST /v1/subscription/redeem'
    + ' returns 409 with error === "monthly_cap".',
  );
});
