import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { config } from '@/constants/config';
import { menuItems, tiers } from '@/services/seed';
import { redeemOptions } from '@almond/shared/loyalty/redeem';
import { nextChallenge } from '@almond/shared/loyalty/challenges';
import { jodFromPoints, pointsFromJod } from '@almond/shared/loyalty/earn';
import { tierProgressCopy } from '@/lib/tierCopy';
import { tierName } from '@almond/shared/loyalty';
import { formatJOD } from '@almond/shared/lib/format';
import { spendEntry } from '@almond/shared/loyalty/window';
import { mockLoyaltyService, __getMockUser } from '@/services/loyalty.service.mock';
import type { TierId } from '@/types';

/**
 * C6-C8 — the two pure modules behind the customer-facing copy.
 *
 * bff/test/copy.test.ts guards the locale FILES (key parity, placeholder
 * parity, no earn rate stated anywhere, no `tiers.*` namespace). These guard
 * what the code puts INTO them: which sentence a member is shown, and whether a
 * reward card names something its own value can buy.
 *
 * Both are outcome tests. C8 asserts the SENTENCE a member sees at a given
 * standing; C7 asserts a rung against a real price out of the shipped menu.
 */

const price = (id: string): number => {
  const item = menuItems.find((m) => m.id === id);
  if (!item) throw new Error(`menu item not found: ${id}`);
  return Math.min(...item.sizes.map((s) => s.price));
};

// ---------------------------------------------------------------------------
// C6 — the tier's name IS its rate.
// ---------------------------------------------------------------------------
describe('C6 tierName', () => {
  it('returns the rate itself, in both languages', () => {
    expect(tiers.map((t) => tierName(t, 'en'))).toEqual(['2%', '4%', '6%']);
    expect(tiers.map((t) => tierName(t, 'ar'))).toEqual(tiers.map((t) => t.nameAr));
  });

  it('the name and the multiplier cannot drift apart', () => {
    // 1 point = 1 qirsh exactly (10,621 live redemptions), so the rung's name is
    // POINTS_PER_JOD × multiplier as a percentage. If a rename ever decoupled
    // the two, a member would be told a rate they are not paid — which is the
    // whole defect this package removes.
    // earn-arith-exempt: asserting the NAME against the ramp — no invoice, no grant. §7 T7.
    const paid = tiers.map((t) => `${config.POINTS_PER_JOD * t.multiplier}%`);
    expect(tiers.map((t) => tierName(t, 'en'))).toEqual(paid);
  });
});

// ---------------------------------------------------------------------------
// C7 — the redemption offers a member money, and never more than they hold.
// ---------------------------------------------------------------------------
/**
 * WHAT THIS USED TO TEST, AND WHY IT COULD NOT SURVIVE. Until 2026-09-08 C7
 * checked a BOARD: four named rewards at four point costs, and its three cases
 * asked whether each card "names something its own value can buy" — the 200-pt
 * "Handcrafted drink" against a 3.950 JOD frappe, the first rung against the
 * cheapest customization on the menu. Points are money now, redeemed straight
 * off the bill, so there is no card, no name and nothing to price against the
 * menu. Those cases are not weakened here; their subject was deleted.
 *
 * What is left is worth more than what went: the old board could be internally
 * consistent and still charge a member one number while showing them another.
 */
describe('C7 the redemption', () => {
  it('C7a never shows a value it does not charge for', () => {
    // The defect this forbids: an option built from the PRESET (2 JOD) while
    // the member is debited pointsFromJod(2). At a rate that is not a whole
    // number of points per JOD those two differ, and the difference is minted
    // on every single redemption. RedeemOption.jod is jodFromPoints(points) by
    // construction — this is the test that says construction is the contract.
    for (const balance of [1, 99, 100, 137, 200, 501, 5000, 283432]) {
      for (const o of redeemOptions(balance)) {
        expect(o.jod, `balance ${balance}, option ${o.id}`).toBe(jodFromPoints(o.points));
      }
    }
  });

  it('C7b never offers more than the member holds', () => {
    for (const balance of [1, 50, 99, 100, 101, 199, 200, 499, 500, 4999]) {
      for (const o of redeemOptions(balance)) {
        expect(o.points, `balance ${balance}, option ${o.id}`).toBeLessThanOrEqual(balance);
      }
    }
    expect(redeemOptions(0)).toEqual([]);
    expect(redeemOptions(-5)).toEqual([]);
  });

  it('C7c the whole balance is always spendable — the presets gate nothing', () => {
    // 🔴 THE ONE THAT MATTERS. FIRST_REWARD_POINTS (138) was a floor: below it a
    // member's points bought nothing at all, and the screen said so. The owner
    // removed the board precisely so that a balance is worth what it is worth
    // at any size. A member holding 1 point must be offered that point.
    for (const balance of [1, 2, 37, 99, 100, 101, 250, 999]) {
      const opts = redeemOptions(balance);
      const full = opts.filter((o) => o.full);
      expect(full.length, `balance ${balance}: exactly one full-balance option`).toBe(1);
      expect(full[0].points, `balance ${balance}: the full option spends it all`).toBe(balance);
    }
  });

  it('C7d rounding never runs in the member\'s favour', () => {
    // pointsFromJod ceils. If it floored, asking for 1 JOD at an awkward rate
    // would spend fewer points than 1 JOD is worth — the house paying for the
    // rounding, on every redemption, forever.
    for (const jod of [0.001, 0.01, 0.25, 1, 1.005, 2, 5, 7.77, 100]) {
      const pts = pointsFromJod(jod);
      expect(jodFromPoints(pts), `${jod} JOD`).toBeGreaterThanOrEqual(jod - 1e-9);
    }
  });

  it('C7e no screen renders the deleted catalogue', () => {
    // Structural, in the style of T23a: the board comes back the moment a
    // screen reads `rewardItems.*` or imports the module again. Both were
    // deleted 2026-09-08; nothing may reference them.
    const banned = ['rewardItems.', 'rewardCatalogue', 'REWARD_RUNGS', 'FIRST_REWARD_POINTS'];
    const roots = ['app', 'components', 'services', 'lib', 'hooks'];
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        if (!/\.tsx?$/.test(e.name)) continue;
        // Code only. A tombstone naming what was deleted must not itself be the
        // violation — see the same stripper in bff/test/copy.test.ts C12.
        const src = readFileSync(full, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
        for (const b of banned) if (src.includes(b)) offenders.push(`${full}: ${b}`);
      }
    };
    for (const r of roots) walk(join(__dirname, '..', r));
    expect(offenders, `The reward board is back: ${offenders.join(' | ')}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// C8 — which sentence a member is shown.
// ---------------------------------------------------------------------------
describe('C8 tierProgressCopy', () => {
  /**
   * 🔴 THIS SUITE CHANGED UNIT, NOT STANDARD. Owner, 2026-09-08: «مش عالزيارات
   * بدي spend more». It used to pin a VISITS count and, with it, an elaborate
   * apparatus for deciding when that count could be stated as a promise and
   * when it had to be hedged — because above the second rung the count was a
   * projection at the 5.85 JOD basket and nothing honoured it.
   *
   * `jodRemaining` is exact at every rung on both code paths, so the hedging
   * has no subject any more. What survives, and is tested harder below, is
   * every case that was ever WRONG: the ratchet, the rung-below-you, the top of
   * the ladder, the ×2 said exactly once.
   */
  it('C8a a member with nothing is 20 JOD from the doubling, and says ×2', () => {
    const c = tierProgressCopy({ windowSpend: 0 }, 'en');
    expect(c).not.toBeNull();
    expect(c!.key).toBe('loyalty.toPlus');
    // The whole threshold, because they have spent nothing. Formatted for the
    // reader — the caller interpolates this string and must not re-decide it.
    expect(c!.params.jod).toBe(formatJOD(tiers[1].threshold, 'en'));
  });

  it('C8b the figure is exact, and shrinks as the member spends', () => {
    // The defect this replaces: the old sentence was a PROJECTION. 15 JOD
    // projected ceil(5 / 5.85) = 1 and rendered "Just one more visit! 🔥 Your
    // rate becomes 4%"; the member came back for a 2.500 JOD americano,
    // finished on 17.50 and was still paid 2%. There is nothing to project now.
    for (const spend of [0, 5, 15, 19.5]) {
      const c = tierProgressCopy({ windowSpend: spend }, 'en')!;
      expect(c.key).toBe('loyalty.toPlus');
      expect(c.params.jod).toBe(formatJOD(tiers[1].threshold - spend, 'en'));
    }
    // And it never goes negative or below zero at the boundary.
    expect(tierProgressCopy({ windowSpend: 20 }, 'en')!.key).toBe('loyalty.toTop');
  });

  it('C8c the second step names 6% and never says a multiplier', () => {
    const c = tierProgressCopy({ windowSpend: 20 }, 'en')!;
    expect(c.key).toBe('loyalty.toTop');
    expect(c.params.jod).toBe(formatJOD(tiers[2].threshold - 20, 'en'));
    // ×1.5 is deliberately never spoken — repeating a multiplier spends it.
    expect(c.params.tier).toBe('6%');
    expect(JSON.stringify(c.params)).not.toContain('×');
  });

  it('C8d the top of the ladder has no progress sentence at all', () => {
    expect(tierProgressCopy({ windowSpend: 65 }, 'en')).toBeNull();
    // ... and a RATCHETED member — held at the top with a window that rolled
    // back to zero — must not be told to climb to a rung they already hold.
    expect(tierProgressCopy({ windowSpend: 0, tier: 'top' as TierId }, 'en')).toBeNull();
    expect(tierProgressCopy({ windowSpend: 0, nextTier: null }, 'en')).toBeNull();
    // ... and the same holds one rung DOWN, which the top-rung-only guard used
    // to miss: a member holding `plus` by floor whose window rolled to 0 was
    // told to climb to the 4% rung they are already paid at, directly beside a
    // badge reading 4%.
    expect(tierProgressCopy({ windowSpend: 0, tier: 'plus' as TierId }, 'en')).toBeNull();
    // A member genuinely below it still gets the sentence.
    expect(tierProgressCopy({ windowSpend: 0, tier: 'base' as TierId }, 'en')!.key)
      .toBe('loyalty.toPlus');
  });

  it('C8e a real standing beats the spend projection', () => {
    // The case that makes this matter: 4 visit-days and 12 JOD. The member is
    // ALREADY on the 4% rung through the visits door, and standing() knows it;
    // progressToNextTier(12) does not, and points them back at 4%. The figure
    // shown is the STANDING'S jodRemaining, not one re-derived here.
    const withStanding = tierProgressCopy(
      {
        windowSpend: 12,
        tier: 'plus' as TierId,
        nextTier: { id: 'top' as TierId, jodRemaining: 53, visitsRemaining: 10, step: 1.5 },
      },
      'en',
    )!;
    expect(withStanding.key).toBe('loyalty.toTop');
    expect(withStanding.params.jod).toBe(formatJOD(53, 'en'));

    const projectionOnly = tierProgressCopy({ windowSpend: 12 }, 'en')!;
    expect(projectionOnly.key).toBe('loyalty.toPlus');
  });

  it('C8f the sentence names the rung and the money in the reader\'s language', () => {
    expect(tierProgressCopy({ windowSpend: 20 }, 'ar')!.params.tier).toBe(tiers[2].nameAr);
    expect(tierProgressCopy({ windowSpend: 20 }, 'en')!.params.tier).toBe('6%');
    // The amount is formatted per language too, in ONE place — a call site that
    // re-formatted it would print different decimals on different screens.
    expect(tierProgressCopy({ windowSpend: 20 }, 'ar')!.params.jod)
      .toBe(formatJOD(tiers[2].threshold - 20, 'ar'));
  });

  it('C8g the visits vocabulary is gone from the sentence entirely', () => {
    // Structural: the two surviving keys must not mention visits in either
    // language, or the unit the owner replaced comes back through the copy.
    for (const lang of ['ar', 'en']) {
      const file = join(__dirname, '..', 'locales', `${lang}.json`);
      const loyaltyNs = JSON.parse(readFileSync(file, 'utf8')).loyalty as Record<string, string>;
      for (const key of ['toPlus', 'toTop']) {
        expect(loyaltyNs[key], `${lang}.json: loyalty.${key} is missing`).toBeTruthy();
        expect(
          loyaltyNs[key],
          `${lang}.json: loyalty.${key} must interpolate {{jod}}`,
        ).toContain('{{jod}}');
        expect(loyaltyNs[key]).not.toContain('{{visits}}');
      }
      // The retired hedging keys must not linger — a key nothing renders is a
      // sentence waiting to be revived by mistake.
      for (const dead of ['oneVisitLeft', 'nearlyNext']) {
        expect(loyaltyNs[dead], `${lang}.json: loyalty.${dead} should be deleted`).toBeUndefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// C8g — the whole chain, through the mock the app actually runs.
// ---------------------------------------------------------------------------
describe('C8g the sentence a real member is shown', () => {
  const DAY = 86_400_000;
  let seq = 0;

  it('a member through the 4-visits door is not told to climb to the rung they hold', async () => {
    // 4 distinct days × 3 JOD = 12 JOD. That is 40% of the 20 JOD door, but
    // TIER2_VISITS_ALTERNATIVE opens the 4% rung anyway, so this member IS on
    // 4%. A spend-only projection (progressToNextTier(12)) still says "N more
    // visits and your cashback DOUBLES" — to a member who already doubled.
    const id = `copy-visits-${++seq}`;
    const u = __getMockUser(id);
    u.spendLog = [1, 4, 9, 20].map((d) => spendEntry(3, new Date(Date.now() - d * DAY)));
    u.heldTierId = 'base';

    const bal = await mockLoyaltyService.getBalance(id);
    expect(bal.tier).toBe('plus');
    expect(bal.visitDays).toBe(4);

    const copy = tierProgressCopy(bal, 'ar')!;
    expect(copy.key).toBe('loyalty.toTop');
    expect(copy.params.tier).toBe(tiers[2].nameAr);
    // The projection alone would have said the opposite.
    expect(tierProgressCopy({ windowSpend: bal.windowSpend }, 'ar')!.key).toBe('loyalty.toPlus');
  });

  it('a ratcheted top-rung member with an empty window is shown no progress at all', async () => {
    const id = `copy-ratchet-${++seq}`;
    const u = __getMockUser(id);
    await mockLoyaltyService.earn({ userId: id, invoiceAmount: 70, paidFromBalance: false });
    u.spendLog = u.spendLog.map((e) => spendEntry(e.jod, new Date(Date.now() - 200 * DAY)));

    const bal = await mockLoyaltyService.getBalance(id);
    expect(bal.windowSpend).toBe(0);
    expect(bal.tier).toBe('top');
    // There is no demotion, so this member is PAID 6%. Telling them they are 4
    // visits from 4% — which windowSpend 0 projects — would be a lie in the
    // opposite direction from the one W4 removed.
    expect(tierProgressCopy(bal, 'en')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// C8h — the DEFAULT member sees the sentence at all.
// ---------------------------------------------------------------------------
describe('C8h the demo seed renders the progress sentence', () => {
  it('a brand-new user of the shipped mock is shown a real, guaranteed sentence', async () => {
    // THE WIRING TEST, not another copy test. Everything above builds its own
    // balance, so none of it can see the state the app actually starts in.
    //
    // The mock's demo seed used to put every unseen userId on 72 JOD across
    // three in-window days with a 'top' floor — the LAST rung, where
    // `standing().next` is null, tierProgressCopy returns null, and all three
    // render sites drop the line. config.DATA_SOURCE is 'mock', the mock's
    // `store` is a fresh Map on every launch and earn() only ever ADDS spend,
    // so that was every user on every launch: the centrepiece of W4 rendered
    // for nobody while 222 unit tests stayed green.
    const bal = await mockLoyaltyService.getBalance(`copy-demo-seed-${Date.now()}`);

    expect(bal.tier).not.toBe(tiers[tiers.length - 1].id);
    expect(bal.nextTier, 'the seeded member must have a rung above them').not.toBeNull();

    const copy = tierProgressCopy(bal, 'en');
    expect(copy, 'the demo member must be shown a progress sentence').not.toBeNull();
    // ... naming a real amount of money. The seed sits inside the entry rung,
    // so the rung above is `plus` and the sentence is the ×2 one.
    expect(copy!.key).toBe('loyalty.toPlus');
    // The FIGURE, end to end: what the mock's standing computed is what the
    // sentence carries. A call site that re-derived it from windowSpend would
    // disagree with the server for any ratcheted member.
    expect(copy!.params.jod).toBe(formatJOD(bal.nextTier!.jodRemaining, 'en'));
    expect(bal.nextTier!.jodRemaining).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// C15 — no screen mixes the two languages.
// ---------------------------------------------------------------------------
/**
 * Owner, 2026-09-08: «الغة اما عربي او انجليزي مش حلو الخلط» — the language is
 * either Arabic or English; mixing is not acceptable.
 *
 * What he saw was "Good evening, ضيف ألموند": an English greeting with an
 * Arabic name interpolated into it. The name was not the member's — the mock
 * OTP handed every sign-in the literal 'ضيف ألموند' and set `isGuest: false`,
 * so the guest branch that exists precisely to avoid this never ran.
 *
 * THE RULE THIS PINS. A display string that exists in one language only cannot
 * live in the logic layers. It belongs in the locale files, where the other
 * language is required to exist beside it (C1). Bilingual PAIRS are exempt and
 * are the correct pattern — `nameAr`/`nameEn`, `titleAr`/`titleEn` — because
 * both languages are present by construction. Comments are exempt: this
 * codebase reasons in Arabic and English throughout, and none of it renders.
 */
describe('C15 no single-language display string outside the locale files', () => {
  const ARABIC = /[؀-ۿ]/;
  const ROOTS = ['services', 'stores', 'lib', 'constants'];

  /** Code with comments stripped — a tombstone quoting the deleted literal
   *  must not itself be the violation. Same stripper as bff C12. */
  const code = (file: string): string =>
    readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(full);
    }
    return out;
  };

  it('the auth layer never invents a display name', () => {
    // The narrow, exact form of the reported bug. `User.name` is a fact about a
    // person: it has no translation, so it is either the real one or empty —
    // never a word the app chose in one language.
    for (const rel of ['services/auth.service.ts', 'stores/authStore.ts']) {
      const src = code(join(__dirname, '..', rel));
      const assigns = [...src.matchAll(/\bname:\s*(['"`])(.*?)\1/g)].map((m) => m[2]);
      for (const value of assigns) {
        expect(
          value,
          `${rel}: name is assigned the literal ${JSON.stringify(value)}.`
          + ' A display name must be the real one or empty — see the comment there.',
        ).toBe('');
      }
    }
  });

  it('no lone Arabic literal sits in a logic layer', () => {
    // The general form. A bilingual pair is fine; a lone one is a string one
    // language's users will read in the other language's screen.
    const BILINGUAL = /\b\w*(Ar|ar)\s*:\s*$/;
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(join(__dirname, '..', root))) {
        const src = code(file);
        for (const m of src.matchAll(/(['"`])((?:(?!\1)[\s\S])*)\1/g)) {
          if (!ARABIC.test(m[2])) continue;
          const before = src.slice(Math.max(0, m.index! - 40), m.index!);
          if (BILINGUAL.test(before)) continue; // nameAr: '…' beside nameEn
          offenders.push(`${file.slice(file.indexOf('almond-app'))}: ${JSON.stringify(m[2])}`);
        }
      }
    }
    expect(
      offenders,
      'Arabic text outside the locale files, with no English beside it.'
      + ` Move it to locales/{ar,en}.json: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// C16 — the onboarding ladder: one challenge, in order, and gone when spent.
// ---------------------------------------------------------------------------
/**
 * Owner, 2026-09-08: «اول دخول بطلعله اول challenge: عبي معلومات وخذ ٥٠ نقطة …
 * بعد اول استخدام، خلي صاحبك ينزل التطبيق وخذ ٥٠ نقطة … بكون لمرة ١ دون ذكر
 * ذلك بس بقدر يعزم اكثر من حدا … وهذا بكون عالبانر».
 *
 * The ordering is the product. These test the pure decision, not the pixels.
 */
describe('C16 nextChallenge', () => {
  const RULES = { profilePoints: 50, referralPoints: 50 };
  const noName = { profile: { name: '' }, referralRewarded: false };

  it('C16a first entry asks for the name, not for friends', () => {
    // «بعد اول استخدام» — a member who has told us nothing about themselves is
    // not the person to ask for their friends' attention.
    expect(nextChallenge(noName, RULES)).toEqual({ id: 'profile', points: 50 });
  });

  it('C16b once the name is in, the referral is offered', () => {
    expect(nextChallenge({ profile: { name: 'حمزة' }, referralRewarded: false }, RULES))
      .toEqual({ id: 'referral', points: 50 });
  });

  it('C16c a spent referral removes the offer — it is never re-pitched', () => {
    // 🔴 THE ONE THAT KEEPS THE UNADVERTISED LIMIT HONEST. The pitch does not
    // say "once", by instruction. What must never happen is the offer being
    // shown again to an account that can no longer be paid for it: not
    // advertising a limit is one thing, repeating a promise you will not honour
    // is another. Sharing stays possible from the referral screen — the member
    // may invite as many people as they like; the ACCOUNT is paid once.
    expect(nextChallenge({ profile: { name: 'حمزة' }, referralRewarded: true }, RULES)).toBeNull();
  });

  it('C16d the banner never shows two things at once', () => {
    for (const name of ['', 'حمزة']) {
      for (const referralRewarded of [false, true]) {
        const c = nextChallenge({ profile: { name }, referralRewarded }, RULES);
        // Either exactly one challenge or none — never an array, never a pair.
        expect(c === null || typeof c.id === 'string').toBe(true);
      }
    }
  });

  it('C16e a challenge that pays nothing is skipped, not shown at 0', () => {
    // Setting a dial to 0 is the documented way to retire a rung. A banner
    // reading "Bring a friend — 0 points" is worse than no banner.
    expect(nextChallenge(noName, { profilePoints: 0, referralPoints: 50 }))
      .toEqual({ id: 'referral', points: 50 });
    expect(nextChallenge(noName, { profilePoints: 0, referralPoints: 0 })).toBeNull();
    expect(nextChallenge(noName, { profilePoints: Number.NaN, referralPoints: -1 })).toBeNull();
  });

  it('C16f the pitch renders the dial, never a number typed into the copy', () => {
    // The defect this forbids is the one the tier rows already carried: "Earn 5
    // points per 1 JOD" in a locale file while the code paid 2. Both challenge
    // strings must interpolate {{points}} in BOTH languages.
    for (const lang of ['ar', 'en']) {
      const file = join(__dirname, '..', 'locales', `${lang}.json`);
      const challenge = JSON.parse(readFileSync(file, 'utf8')).challenge as Record<string, string>;
      for (const key of ['profile', 'referral']) {
        expect(challenge?.[key], `${lang}.json: challenge.${key} is missing`).toBeTruthy();
        expect(
          challenge[key],
          `${lang}.json: challenge.${key} must carry {{points}} rather than a typed number`,
        ).toContain('{{points}}');
      }
    }
  });

  it('C16g the shipped dials really do drive it', () => {
    // challengeRulesFromConfig, not the hand-written RULES above — so editing
    // the config moves this test rather than leaving it pinned to 50.
    expect(nextChallenge(noName)).toEqual({
      id: 'profile', points: config.PROFILE_COMPLETION_BONUS,
    });
    expect(nextChallenge({ profile: { name: 'x' }, referralRewarded: false })).toEqual({
      id: 'referral', points: config.REFERRAL_REWARD_POINTS,
    });
  });
});
