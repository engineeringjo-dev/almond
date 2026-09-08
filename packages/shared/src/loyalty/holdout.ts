/**
 * The deterministic control-group holdout — LOYALTY-ODOO-ARCHITECTURE §4.11,
 * and the thing the BRIEF §3 W3 asks for: a stable assignment from
 * (memberKey, experiment) that needs NO STORAGE and gives the same answer on
 * every device and every server.
 *
 * WHY IT EXISTS. The second-visit voucher is priced against the measured 45.8%
 * hazard at the 1→2 visit step, but Almond's own data says a first reward does
 * NOT re-engage: within-member around first redemption (n=1,238) visits fell
 * 1.4% and spend 4.9% against a −2.3% control, where the literature reports +3%
 * and +17.5%. Shipped to everyone, the mechanic cannot be told apart from doing
 * nothing. Shipped against a control arm, it can.
 *
 * THIS MODULE DIFFERS FROM §4.11'S OWN SNIPPET in three deliberate ways. When
 * `integrations/almond_loyalty` lands it must port THIS FILE, not the snippet,
 * and holdout.vectors.json is checked in as the cross-language golden-vector
 * gate §4.2 of docs/LOYALTY-ODOO-MODULE.md already requires:
 *
 *   1. The experiment key is part of the hash input. §4.11 hashes
 *      f"{partner_id}:{salt}" with no experiment in it, so every experiment
 *      would draw the SAME members into the control arm forever — the second
 *      experiment's control group would be the first one's, and neither result
 *      would generalise.
 *   2. The input is LENGTH-PREFIXED BY UTF-8 BYTE COUNT (see
 *      canonicalHoldoutInput). Plain concatenation is not injective, and a
 *      code-unit prefix would give JavaScript and Python different digests.
 *   3. The digest maps to an arm by a THRESHOLD, not `% 100`. 2**32 % 100 ===
 *      96, so §4.11's modulo is not uniform (see assignHoldout).
 *
 * THIS MODULE READS NO CLOCK. A HoldoutStamp carries no timestamp on purpose:
 * the record it hangs on (the order) already has `createdAt`, and the BFF, the
 * phone and the till are not on the same clock — see lib/ammanWeekday.ts.
 */
import { config } from '../config';
import { sha256, utf8Bytes } from '../lib/sha256';

/** Never a boolean. `if (holdout) issueVoucher()` is the bug this type removes:
 *  a string union has no truthy value to read backwards. */
export type HoldoutArm = 'holdout' | 'treatment';

/** Everything the assignment depends on, in one injectable object — the same
 *  shape as `computeEarn(ctx, rules = earnRulesFromConfig())` in earn.ts:103.
 *  Production reads one config; tests pass literals. A share passed loose at
 *  each call site is how the BFF and the app end up putting the same member in
 *  different arms. */
export interface HoldoutSpec {
  /** The experiment's stable key, e.g. 'second-visit-voucher'. */
  experiment: string;
  /** Basis points withheld: 0 = nobody, 10000 = everybody. */
  holdoutShareBp: number;
  /** The secret-that-is-not-a-secret. Rotating it moves 31.73% of members. */
  salt: string;
  /** Which salt epoch this is. Stamped; the salt itself never is. */
  saltId: string;
}

/**
 * The decision AND the record — deliberately one type, not an assignment type
 * plus a stamp type plus a toStamp() that can drop a field.
 *
 * COMPUTABLE IS NOT RECONSTRUCTIBLE, which is the whole reason this is written
 * down. Checked-in vector m_10 sits at bucket 910,747,998 = 21.2050% of the
 * space: treatment at 2000 bp, holdout at 2500 bp. A single basis-point edit
 * silently re-labels every historical order of every member in that band —
 * docs/LOYALTY-ODOO-MODULE.md:763-767 names reading group membership at
 * ANALYSIS time rather than ISSUE time as the classic way to invalidate a
 * holdout. `bucket` and `threshold` are both stored so the row can verify its
 * own arm without the salt, and so replayStamp() can say WHY a stamp stopped
 * reproducing rather than only that it did.
 */
export interface HoldoutStamp {
  experiment: string;
  arm: HoldoutArm;
  /** The uniform draw in [0, 2**32) that decided it. */
  bucket: number;
  /** The value `bucket` was compared against, at issue time. */
  threshold: number;
  holdoutShareBp: number;
  saltId: string;
}

/** Every experiment that is assigned. Adding a key here without adding its
 *  share to config.HOLDOUT.holdoutShareBp throws at
 *  holdoutSpecFromConfig() — a Record<string, number> cannot express that
 *  completeness, so bff/test/holdout.test.ts H11 asserts it. */
export const HOLDOUT_EXPERIMENTS = {
  secondVisitVoucher: 'second-visit-voucher',
} as const;

export type ExperimentId = keyof typeof HOLDOUT_EXPERIMENTS;

const BUCKET_SPACE = 4294967296; // 2**32
const BP_FULL = 10000;

export function holdoutSpecFromConfig(id: ExperimentId): HoldoutSpec {
  const shareBp = config.HOLDOUT.holdoutShareBp[id];
  if (typeof shareBp !== 'number') {
    // No default. A default share is an arm split nobody chose, and it would be
    // invisible: the experiment would run at a rate no one wrote down.
    throw new Error(`holdout: no configured share for experiment '${id}'`);
  }
  return {
    experiment: HOLDOUT_EXPERIMENTS[id],
    holdoutShareBp: shareBp,
    salt: config.HOLDOUT.salt,
    saltId: config.HOLDOUT.saltId,
  };
}

/**
 * The exact bytes that get hashed:
 *   `${u8len(salt)}:${salt}|${u8len(experiment)}:${experiment}|${u8len(key)}:${key}`
 *
 * TWO DEFECTS ARE BEING AVOIDED HERE, both real:
 *
 * (a) Plain concatenation is NOT INJECTIVE. With a bare delimiter, experiment
 *     'a|b' + key 'c' and experiment 'a' + key 'b|c' produce the same string
 *     and therefore the same arm. Length prefixes make the decode unambiguous
 *     with no field validation and no forbidden characters.
 *
 * (b) The prefix counts UTF-8 BYTES, not characters. 'm_😀'.length is 4 in
 *     JavaScript (UTF-16 code units) and len() is 3 in Python (code points);
 *     the UTF-8 byte count is 6 in both. A code-unit prefix would give the BFF
 *     and the Odoo evaluator DIFFERENT digests for the same member — the D2
 *     divergence again, on a dial T7's name-based walk cannot see. Two
 *     non-ASCII golden vectors ('عضو-١٢٣' → prefix 13, 'm_😀' → prefix 6) fail
 *     exactly the wrong port and pass every ASCII row.
 */
export function canonicalHoldoutInput(memberKey: string, spec: HoldoutSpec): string {
  const u8 = (s: string): number => utf8Bytes(s).length;
  return `${u8(spec.salt)}:${spec.salt}`
    + `|${u8(spec.experiment)}:${spec.experiment}`
    + `|${u8(memberKey)}:${memberKey}`;
}

/**
 * `Math.floor(shareBp * 2**32 / 10000)` — the value a bucket must fall BELOW to
 * be withheld.
 *
 * WHY NOT §4.11'S `% 100`: 2**32 % 100 === 96, so 96 of the 100 residues get
 * 42,949,673 draws and 4 get 42,949,672 — a relative excess of 2.328e-8, and a
 * bias that is structural rather than a rounding artefact. A threshold has no
 * residue classes at all; its only inexactness is this floor, measured at a
 * worst case of 2.325e-10 over ALL 10,001 basis-point shares (worst at bp
 * 5429), 100× tighter.
 *
 * Every step stays exact in float64: shareBp * 2**32 ≤ 4.295e13 < 2**53. Both
 * ends are exact with no off-by-one — bp 0 gives threshold 0 and holds nobody
 * (no bucket is < 0), bp 10000 gives threshold 2**32 and holds everybody
 * (every bucket is < 2**32).
 */
export function holdoutThreshold(holdoutShareBp: number): number {
  return Math.floor((holdoutShareBp * BUCKET_SPACE) / BP_FULL);
}

/**
 * THE assignment. Deterministic, storage-free, and identical everywhere.
 *
 * Throws rather than guessing on every malformed input: an empty member key
 * would put every anonymous caller in the same arm, and an out-of-range or
 * fractional share would run the experiment at a rate nobody chose.
 */
export function assignHoldout(memberKey: string, spec: HoldoutSpec): HoldoutStamp {
  if (typeof memberKey !== 'string' || memberKey.length === 0) {
    throw new Error('holdout: memberKey must be a non-empty string');
  }
  if (typeof spec.salt !== 'string' || spec.salt.length === 0) {
    throw new Error('holdout: salt must be a non-empty string');
  }
  if (typeof spec.experiment !== 'string' || spec.experiment.length === 0) {
    throw new Error('holdout: experiment must be a non-empty string');
  }
  if (!Number.isInteger(spec.holdoutShareBp)) {
    throw new Error(`holdout: holdoutShareBp must be an integer, got ${spec.holdoutShareBp}`);
  }
  if (spec.holdoutShareBp < 0 || spec.holdoutShareBp > BP_FULL) {
    throw new Error(`holdout: holdoutShareBp must be 0..${BP_FULL}, got ${spec.holdoutShareBp}`);
  }

  const digest = sha256(utf8Bytes(canonicalHoldoutInput(memberKey, spec)));
  // Big-endian by multiplication, not `<<`: `digest[0] << 24` is SIGNED in
  // JavaScript and goes negative for half of all digests.
  const bucket = digest[0] * 16777216 + digest[1] * 65536 + digest[2] * 256 + digest[3];
  const threshold = holdoutThreshold(spec.holdoutShareBp);
  return {
    experiment: spec.experiment,
    arm: bucket < threshold ? 'holdout' : 'treatment',
    bucket,
    threshold,
    holdoutShareBp: spec.holdoutShareBp,
    saltId: spec.saltId,
  };
}

/**
 * THE ONLY PREDICATE. Named for what the member GETS, not for which bucket they
 * landed in, because the bug this whole API shape exists to prevent is
 * `if (holdout) issueVoucher()`.
 *
 * There is deliberately no `isInHoldout` / `isWithheld` sibling: with one
 * predicate there is no wrong one to pick. bff/test/holdout.test.ts H9 also
 * forbids `.arm ===` / `.arm !==` anywhere outside this file, so a call site
 * cannot open-code the comparison and get it backwards either.
 *
 * NOTE THE LIMIT, honestly: nothing here stops
 * `if (receivesTreatment(a)) withhold()`. Only an assertion on the OUTCOME
 * catches that, and that assertion belongs to whoever ships the voucher (W2).
 * The golden vectors are checked in for it: m_3, m_5 and m_8 are holdout;
 * 'demo' and m_0 are treatment.
 */
export function receivesTreatment(stamp: HoldoutStamp): boolean {
  return stamp.arm === 'treatment';
}

/** One stamp per registered experiment. Plural from the start so a second
 *  experiment needs no migration of anything already written. */
export function stampAllExperiments(memberKey: string): HoldoutStamp[] {
  return (Object.keys(HOLDOUT_EXPERIMENTS) as ExperimentId[])
    .map((id) => assignHoldout(memberKey, holdoutSpecFromConfig(id)));
}

/** Does the row agree with ITSELF? Needs no salt and no member key: the bucket
 *  and the threshold are both on the record, so a hand-edited `arm` is visible
 *  without recomputing anything. */
export function stampIsSelfConsistent(stamp: HoldoutStamp): boolean {
  if (!Number.isInteger(stamp.bucket) || stamp.bucket < 0 || stamp.bucket >= BUCKET_SPACE) return false;
  if (stamp.threshold !== holdoutThreshold(stamp.holdoutShareBp)) return false;
  const expected: HoldoutArm = stamp.bucket < stamp.threshold ? 'holdout' : 'treatment';
  return stamp.arm === expected;
}

export type StampReplayVerdict =
  /** The stamp reproduces exactly under this spec. */
  | 'agrees'
  /** The salt epoch moved: the stamp belongs to a different experiment epoch
   *  and CANNOT be reproduced. Nothing is wrong with the stamp. */
  | 'salt-rotated'
  /** Same draw, different share: the arm boundary was moved after the fact.
   *  This is the §4.11 defect — re-labelling history by editing a config. */
  | 'share-changed'
  /** The draw itself does not reproduce: wrong member key, a changed canonical
   *  encoding or digest step, or a hand-edited arm. */
  | 'arm-mismatch';

export interface StampReplay {
  verdict: StampReplayVerdict;
  /** What was written down at issue time. */
  stamp: HoldoutStamp;
  /** What this member key and spec produce today. */
  recomputed: HoldoutStamp;
}

/**
 * Re-derive an arm and say what — if anything — moved underneath it.
 *
 * This is the answer to "an analyst recomputes the arms six months later".
 * Without it, a share edited from 2000 to 2500 bp silently re-labels every
 * member in the 20.00-25.00% band (vector m_10 is checked in AT 21.2050% for
 * exactly this) and the recomputation looks like it worked.
 */
export function replayStamp(
  stamp: HoldoutStamp,
  memberKey: string,
  spec: HoldoutSpec,
): StampReplay {
  const recomputed = assignHoldout(memberKey, spec);
  let verdict: StampReplayVerdict;
  if (stamp.saltId !== spec.saltId) verdict = 'salt-rotated';
  else if (stamp.bucket !== recomputed.bucket) verdict = 'arm-mismatch';
  else if (stamp.holdoutShareBp !== recomputed.holdoutShareBp) verdict = 'share-changed';
  else if (stamp.arm !== recomputed.arm) verdict = 'arm-mismatch';
  else verdict = 'agrees';
  return { verdict, stamp, recomputed };
}
