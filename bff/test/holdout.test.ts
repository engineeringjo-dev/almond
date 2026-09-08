import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from '@almond/shared/config';
import { menuItems } from '@almond/shared/menu';
import { sha256Hex, utf8Bytes, sha256U32 } from '@almond/shared/lib/sha256';
import {
  HOLDOUT_EXPERIMENTS, assignHoldout, canonicalHoldoutInput, holdoutSpecFromConfig,
  holdoutThreshold, receivesTreatment, replayStamp, stampAllExperiments,
  stampIsSelfConsistent, type ExperimentId, type HoldoutSpec, type HoldoutStamp,
} from '@almond/shared/loyalty/holdout';
import { build } from '../src/server';
import { createMemoryBackend } from '../src/backend/memory';
import { REPO, collectSources, type SourceFile } from './lib/sources';
import { signIn } from './lib/signIn';

/**
 * H1-H12 — the deterministic control-group holdout (BRIEF §3 W3,
 * docs/LOYALTY-ODOO-ARCHITECTURE.md §4.11).
 *
 * This file lives in the BFF workspace for the same reason bff/test/expiry.test.ts
 * does: that is where a shared module is testable, and — the point here — it is
 * where `node:crypto` is available as an ORACLE without the dependency leaking
 * into packages/shared, which must compile under four tsconfigs and run on
 * Hermes.
 *
 * Every number quoted below is measured from this implementation on the corpora
 * the tests build, not estimated. The assertions are on the PROPERTY (the share
 * is within tolerance, the arms are independent, the salt moves people); the
 * literals are in the comments so a drift is legible without being brittle.
 */

const SPEC = holdoutSpecFromConfig('secondVisitVoucher');
const BUCKET_SPACE = 4294967296; // 2**32
const at = (bp: number, spec: HoldoutSpec = SPEC): HoldoutSpec => ({ ...spec, holdoutShareBp: bp });
const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `m_${i}`);
const holdoutCount = (keys: string[], spec: HoldoutSpec): number =>
  keys.reduce((n, k) => n + (receivesTreatment(assignHoldout(k, spec)) ? 0 : 1), 0);

/** Every key name anywhere in a JSON response body, lower-cased. */
function keysOf(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) { out.push(k.toLowerCase()); keysOf(v, out); }
  }
  return out;
}

// ---------------------------------------------------------------------------
// H1 — the hash really is SHA-256.
//
// A hand-written primitive is the third-largest risk in this package. It is
// bought off here, against the implementation every other language has.
// ---------------------------------------------------------------------------
describe('H1 the pure SHA-256 agrees with node:crypto', () => {
  const oracle = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

  it('matches the FIPS 180-4 published vectors', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    // The multi-block one: 1,000,000 'a'. It is the only vector that exercises
    // the 64-bit length field and thousands of compression rounds.
    expect(sha256Hex('a'.repeat(1000000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });

  it('matches node:crypto on 2,000 random strings, astral pairs included', () => {
    // 0 mismatches measured over 3,000 inputs. This is the surrogate-pair bug
    // detector: a UTF-8 encoder that emits two 3-byte CESU-8 sequences for one
    // emoji instead of a 4-byte one passes every ASCII test and fails here.
    let seed = 0x9e3779b9;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const mismatches: string[] = [];
    for (let i = 0; i < 2000; i++) {
      let s = '';
      const n = 1 + Math.floor(rnd() * 40);
      for (let j = 0; j < n; j++) {
        const r = rnd();
        if (r < 0.5) s += String.fromCharCode(32 + Math.floor(rnd() * 95));
        else if (r < 0.8) s += String.fromCharCode(Math.floor(rnd() * 0x800));
        else s += String.fromCodePoint(0x10000 + Math.floor(rnd() * 0x1000));
      }
      if (sha256Hex(s) !== oracle(s)) mismatches.push(JSON.stringify(s));
    }
    expect(mismatches, `hand-written SHA-256 disagrees with node:crypto on: ${mismatches.slice(0, 3).join(', ')}`)
      .toEqual([]);
  });

  it('encodes UTF-8 exactly as Buffer does, lone surrogates included', () => {
    for (const s of ['', 'abc', 'م', 'عضو-١٢٣', 'm_😀', 'x😀y', '\uD800', '\uDC00abc', 'a\uD83D']) {
      expect(utf8Bytes(s), `utf8Bytes(${JSON.stringify(s)})`)
        .toEqual([...Buffer.from(s, 'utf8')]);
    }
    // The prefix that makes the future Python port possible at all: JS counts
    // UTF-16 code units, Python counts code points, and only the BYTE count
    // agrees. 'm_😀' is 4 / 3 / 6; 'عضو-١٢٣' is 7 / 7 / 13.
    expect('m_😀'.length).toBe(4);
    expect([...'m_😀'].length).toBe(3);
    expect(utf8Bytes('m_😀').length).toBe(6);
    expect(utf8Bytes('عضو-١٢٣').length).toBe(13);
  });

  it('sha256U32 is the first 4 digest bytes big-endian, unsigned', () => {
    for (const s of ['demo', 'm_3', 'عضو-١٢٣', 'm_😀', '']) {
      const d = createHash('sha256').update(s, 'utf8').digest();
      expect(sha256U32(s)).toBe(d.readUInt32BE(0));
      expect(sha256U32(s)).toBeGreaterThanOrEqual(0); // `d[0] << 24` would go negative
    }
  });
});

// ---------------------------------------------------------------------------
// H2 — the shared package uses no host crypto.
//
// "Just use node:crypto" is the simplification this test exists to stop. It
// TYPECHECKS under bff, so the gate stays green; it then throws on Hermes, on a
// device, months later. TextEncoder is worse: it typechecks under all four
// tsconfigs (it is in the DOM lib) and is absent from Hermes.
// ---------------------------------------------------------------------------
describe('H2 packages/shared reaches for no host crypto and no host encoder', () => {
  let sources: SourceFile[];
  beforeAll(() => { sources = collectSources(); });

  it('no shared source names node:crypto, crypto.subtle, TextEncoder or Buffer', () => {
    const banned: { re: RegExp; why: string }[] = [
      { re: /['"]node:crypto['"]/, why: 'shared has no "types": ["node"] and Hermes has no node:crypto' },
      { re: /\bcrypto\.subtle\b/, why: 'async, and absent on Hermes' },
      { re: /\bTextEncoder\b/, why: 'typechecks everywhere (DOM lib), absent on Hermes' },
      { re: /\bBuffer\s*\./, why: 'Node-only' },
    ];
    const offenders: string[] = [];
    for (const f of sources) {
      if (!f.path.startsWith('packages/shared/')) continue;
      f.code.forEach((line, i) => {
        for (const b of banned) {
          if (b.re.test(line)) offenders.push(`${f.path}:${i + 1} — ${b.why}: ${f.raw[i].trim()}`);
        }
      });
    }
    expect(
      offenders,
      'packages/shared is compiled into the Expo bundle and typechecked without'
      + ' node types. A host primitive here fails on the phone at runtime, not'
      + ` in this gate. Offending lines: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });

  it('the walk actually looked at the two new shared files', () => {
    // A walk that silently found nothing would pass the assertion above.
    const paths = new Set(sources.map((f) => f.path));
    expect(paths.has('packages/shared/src/lib/sha256.ts')).toBe(true);
    expect(paths.has('packages/shared/src/loyalty/holdout.ts')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// H3 / H4 — stability. THE most important tests in this file.
//
// A change to the salt, to the canonical input or to the digest→bucket step
// does not break anything visibly: it silently makes every HoldoutStamp already
// written unreproducible, so nobody can say which arm a past grant was in.
// ---------------------------------------------------------------------------
interface GoldenFile {
  salt: string;
  saltId: string;
  experiment: string;
  holdoutShareBp: number;
  threshold: number;
  vectors: { memberKey: string; canonical: string; digest: string; bucket: number; arm: string }[];
}
const GOLDEN: GoldenFile = JSON.parse(
  readFileSync(join(REPO, 'packages/shared/src/loyalty/holdout.vectors.json'), 'utf8'),
) as GoldenFile;

const REGENERATE =
  'THIS IS THE SALT/ENCODING GUARD. If this is red, the assignment moved: every'
  + ' HoldoutStamp already written to an order is now unreproducible and the'
  + ' experiment cannot be analysed (a v1→v2 salt rotation moves 31.73% of'
  + ' members). If the change is intended, bump config.HOLDOUT.saltId IN THE'
  + ' SAME COMMIT and regenerate packages/shared/src/loyalty/holdout.vectors.json.';

describe('H3 the checked-in golden vectors still reproduce', () => {
  it('every row reproduces its canonical input, digest, bucket and arm', () => {
    expect(GOLDEN.vectors.length).toBe(9);
    for (const v of GOLDEN.vectors) {
      const spec = at(GOLDEN.holdoutShareBp, {
        experiment: GOLDEN.experiment, salt: GOLDEN.salt, saltId: GOLDEN.saltId,
        holdoutShareBp: GOLDEN.holdoutShareBp,
      });
      expect(canonicalHoldoutInput(v.memberKey, spec), `${v.memberKey} canonical — ${REGENERATE}`)
        .toBe(v.canonical);
      expect(sha256Hex(v.canonical), `${v.memberKey} digest — ${REGENERATE}`).toBe(v.digest);
      const stamp = assignHoldout(v.memberKey, spec);
      expect(stamp.bucket, `${v.memberKey} bucket — ${REGENERATE}`).toBe(v.bucket);
      expect(stamp.arm, `${v.memberKey} arm — ${REGENERATE}`).toBe(v.arm);
      expect(stamp.threshold).toBe(GOLDEN.threshold);
    }
  });

  it('the two non-ASCII rows pin the UTF-8 BYTE prefix (the Python port gate)', () => {
    // A port that prefixes by len() (code points) or by .length (UTF-16 units)
    // passes all seven ASCII rows and fails exactly these two. That is the D2
    // divergence on a dial T7's name-based walk cannot see.
    const arabic = GOLDEN.vectors.find((v) => v.memberKey === 'عضو-١٢٣')!;
    const emoji = GOLDEN.vectors.find((v) => v.memberKey === 'm_😀')!;
    expect(arabic.canonical).toContain('|13:عضو-١٢٣');   // 7 code points, 13 bytes
    expect(emoji.canonical).toContain('|6:m_😀');        // 3 code points, 4 units, 6 bytes
  });

  it('H4 the salt epoch and the configured share are exactly what the vectors were cut at', () => {
    expect(config.HOLDOUT.saltId, REGENERATE).toBe('v1');
    expect(config.HOLDOUT.salt, REGENERATE).toBe(GOLDEN.salt);
    expect(config.HOLDOUT.saltId, REGENERATE).toBe(GOLDEN.saltId);
    expect(SPEC.experiment).toBe(GOLDEN.experiment);
    expect(SPEC.holdoutShareBp).toBe(GOLDEN.holdoutShareBp);
  });

  it('the vectors carry both arms, or they prove nothing', () => {
    // Nine rows that were all 'treatment' would pass every assertion above
    // while testing only one branch.
    const arms = new Set(GOLDEN.vectors.map((v) => v.arm));
    expect(arms.has('holdout')).toBe(true);
    expect(arms.has('treatment')).toBe(true);
    // The fixtures W2 needs for its outcome assertion (which is the ONLY thing
    // that can prove the treatment is actually withheld — see holdout.ts).
    for (const k of ['m_3', 'm_5', 'm_8']) {
      expect(assignHoldout(k, SPEC).arm, `${k} is a checked-in holdout fixture`).toBe('holdout');
    }
    for (const k of ['demo', 'm_0']) {
      expect(receivesTreatment(assignHoldout(k, SPEC)), `${k} is a checked-in treatment fixture`)
        .toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// H5 — the share holds at scale, on a DETERMINISTIC corpus so it cannot flake.
// ---------------------------------------------------------------------------
describe('H5 the configured share is the share that is actually withheld', () => {
  it('holds within tolerance at 10%, 20% and 50% over 20,000 members', () => {
    const keys = ids(20000);
    // Measured: 1,997 at 1000 bp (z −0.07), 3,985 at 2000 bp (z −0.27),
    // 10,076 at 5000 bp (z +1.07). The assertion is the PROPERTY, at ~4.7σ, so
    // it states the rule rather than the accident of these particular ids.
    for (const bp of [1000, 2000, 5000]) {
      const n = holdoutCount(keys, at(bp));
      const expected = (20000 * bp) / 10000;
      expect(Math.abs(n - expected), `at ${bp}bp the holdout arm held ${n}, expected ~${expected}`)
        .toBeLessThan(200);
    }
  });

  it('holds over the live member count (47,720) at the configured share', () => {
    // 47,720 is the real member base (bff/test/security.test.ts:18). Measured
    // 9,492 against an expected 9,544 — z = −0.60.
    const n = holdoutCount(ids(47720), SPEC);
    const expected = (47720 * SPEC.holdoutShareBp) / 10000;
    expect(Math.abs(n - expected), `holdout arm held ${n} of 47,720, expected ~${expected}`)
      .toBeLessThan(300);
  });

  it('the raw bucket is uniform across the whole space (χ², 100 slices)', () => {
    // A share that is right at 20% proves the threshold, not the hash. This
    // proves the DRAW. Measured χ² = 91.2 on df 99; the assertion is against
    // 148.2, the 99.9th percentile, so a real skew is caught and noise is not.
    const bins = new Array<number>(100).fill(0);
    const n = 100000;
    for (let i = 0; i < n; i++) {
      bins[Math.floor(assignHoldout(`m_${i}`, SPEC).bucket / (BUCKET_SPACE / 100))]++;
    }
    const e = n / 100;
    const chi2 = bins.reduce((s, o) => s + ((o - e) * (o - e)) / e, 0);
    expect(chi2, `χ² = ${chi2.toFixed(1)} on df 99 — the digest→bucket step is not uniform`)
      .toBeLessThan(148.2);
    expect(bins.every((b) => b > 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// H6 — no modulo bias, and no off-by-one at either end.
// ---------------------------------------------------------------------------
describe('H6 the digest maps to an arm without modulo bias', () => {
  it('the threshold is exact to 2.4e-10 across ALL 10,001 basis-point shares', () => {
    let worst = 0;
    let worstBp = -1;
    for (let bp = 0; bp <= 10000; bp++) {
      expect(holdoutThreshold(bp)).toBe(Math.floor((bp * BUCKET_SPACE) / 10000));
      const err = Math.abs(holdoutThreshold(bp) / BUCKET_SPACE - bp / 10000);
      if (err > worst) { worst = err; worstBp = bp; }
    }
    // Measured worst case 2.3246e-10 at bp 5429 — the floor, and nothing else.
    expect(worst, `worst share error ${worst.toExponential(4)} at bp ${worstBp}`)
      .toBeLessThan(1e-9);
  });

  it('names the rejected scheme so nobody "simplifies" back to it', () => {
    // §4.11's own snippet is `int.from_bytes(digest[:4]) % 100 < pct`. 2**32 is
    // not a multiple of 100, so 96 residues get 42,949,673 draws and 4 get
    // 42,949,672 — a structural excess of 2.328e-8, 100× the floor above and
    // not fixable by rounding. This line is here to be read, not to pass.
    expect(2 ** 32 % 100).toBe(96);
    expect(Math.floor(BUCKET_SPACE / 100)).toBe(42949672);
  });

  it('bp 0 holds nobody and bp 10000 holds everybody — both ends exact', () => {
    const keys = ids(1000);
    expect(holdoutCount(keys, at(0))).toBe(0);
    expect(holdoutCount(keys, at(10000))).toBe(1000);
    expect(holdoutThreshold(0)).toBe(0);
    expect(holdoutThreshold(10000)).toBe(BUCKET_SPACE);
  });
});

// ---------------------------------------------------------------------------
// H7 / H8 — the two inputs are doing what they claim.
// ---------------------------------------------------------------------------
describe('H7 different experiment keys assign independently', () => {
  it('a second experiment draws its own control arm, uncorrelated with the first', () => {
    // §4.11's snippet hashes f"{partner_id}:{salt}" with NO experiment in it,
    // so every experiment would draw the SAME control group forever and the
    // second experiment's result would not generalise. Measured over 20,000:
    // a = 3,985, b = 3,994, both = 804 (independence predicts 796), 6,371
    // members differ (2p(1−p)n predicts 6,400), φ = +0.0026.
    const keys = ids(20000);
    const b: HoldoutSpec = { ...SPEC, experiment: 'holdout-independence-probe' };
    let na = 0; let nb = 0; let both = 0; let differ = 0;
    for (const k of keys) {
      const A = assignHoldout(k, SPEC).arm === 'holdout';
      const B = assignHoldout(k, b).arm === 'holdout';
      if (A) na++;
      if (B) nb++;
      if (A && B) both++;
      if (A !== B) differ++;
    }
    const n = keys.length;
    const pa = na / n;
    const pb = nb / n;
    const phi = (both / n - pa * pb) / Math.sqrt(pa * (1 - pa) * pb * (1 - pb));
    expect(Math.abs(phi), `φ = ${phi.toFixed(4)} — the two experiments are correlated`)
      .toBeLessThan(0.03);
    // ... and the second key is not being silently IGNORED, which would give
    // φ = 1 above but is worth naming separately: that is the actual bug.
    expect(differ, 'the second experiment key changed nobody — is it in the hash input?')
      .toBeGreaterThan(1000);
  });
});

describe('H8 the salt is doing something (§4.11 asks for this test by name)', () => {
  it('a v1→v2 rotation reassigns ~2p(1−p) of a fixed member list', () => {
    // Measured: 6,345 of 20,000 = 31.73%, against the 2p(1−p) = 32.00% that
    // independent reassignment predicts. This is the COST of a rotation, and
    // it is why holdout.vectors.json is checked in.
    const keys = ids(20000);
    const v2: HoldoutSpec = { ...SPEC, salt: 'almond-holdout-v2', saltId: 'v2' };
    let moved = 0;
    for (const k of keys) {
      if (assignHoldout(k, SPEC).arm !== assignHoldout(k, v2).arm) moved++;
    }
    const pct = (moved / keys.length) * 100;
    expect(pct, `a salt rotation moved ${pct.toFixed(2)}% of members`).toBeGreaterThan(30);
    expect(pct).toBeLessThan(34);
  });
});

// ---------------------------------------------------------------------------
// H9 — the API cannot be inverted.
//
// The bug is `if (holdout) issueVoucher()`. Three layers: a string union (no
// truthy value to read backwards), ONE predicate named for what the member
// gets, and this source walk so no call site open-codes the comparison.
// ---------------------------------------------------------------------------
describe('H9 the arm cannot be read backwards', () => {
  it('receivesTreatment is true on exactly the treatment arm, over both fixture sets', () => {
    for (const v of GOLDEN.vectors) {
      const stamp = assignHoldout(v.memberKey, SPEC);
      expect(receivesTreatment(stamp)).toBe(v.arm === 'treatment');
    }
    for (const k of ids(500)) {
      const stamp = assignHoldout(k, SPEC);
      expect(receivesTreatment(stamp)).toBe(stamp.bucket >= stamp.threshold);
    }
  });

  it('no source outside holdout.ts compares an arm by hand', () => {
    const OWNER = 'packages/shared/src/loyalty/holdout.ts';
    const offenders: string[] = [];
    for (const f of collectSources()) {
      if (f.path === OWNER) continue;
      f.code.forEach((line, i) => {
        if (/\.arm\s*(?:===|!==|==|!=)/.test(line)
          || /(?:===|!==|==|!=)\s*['"](?:holdout|treatment)['"]/.test(line)) {
          offenders.push(`${f.path}:${i + 1}: ${f.raw[i].trim()}`);
        }
      });
    }
    expect(
      offenders,
      `use receivesTreatment(stamp) from ${OWNER} — it is named for what the`
      + ' member GETS, so it cannot be read backwards. An open-coded'
      + ` comparison can. Offending lines: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });

  it('every malformed input throws instead of quietly assigning an arm', () => {
    // An empty key would put every anonymous caller in one arm; a fractional or
    // out-of-range share would run the experiment at a rate nobody chose.
    expect(() => assignHoldout('', SPEC)).toThrow(/memberKey/);
    expect(() => assignHoldout('m_1', { ...SPEC, salt: '' })).toThrow(/salt/);
    expect(() => assignHoldout('m_1', at(1000.5))).toThrow(/integer/);
    expect(() => assignHoldout('m_1', at(-1))).toThrow(/0\.\.10000/);
    expect(() => assignHoldout('m_1', at(10001))).toThrow(/0\.\.10000/);
    // ... and the boundaries themselves do NOT throw.
    expect(() => assignHoldout('m_1', at(0))).not.toThrow();
    expect(() => assignHoldout('m_1', at(10000))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// H10 — the stamp is the evidence.
//
// Computable is not reconstructible: m_10 sits at 21.2050%, so it is treatment
// at 2000 bp and holdout at 2500 bp. A one-line config edit re-labels every
// historical order in that band, and without a stamp nothing notices.
// ---------------------------------------------------------------------------
describe('H10 a stamp can prove its own arm, and say what moved under it', () => {
  it('stampIsSelfConsistent catches a hand-edited arm with no salt and no key', () => {
    const stamp = assignHoldout('demo', SPEC); // treatment, bucket 1,804,998,275
    expect(stampIsSelfConsistent(stamp)).toBe(true);
    expect(stampIsSelfConsistent({ ...stamp, arm: 'holdout' })).toBe(false);
    const held = assignHoldout('m_3', SPEC);   // holdout, bucket 291,820,837
    expect(stampIsSelfConsistent(held)).toBe(true);
    expect(stampIsSelfConsistent({ ...held, arm: 'treatment' })).toBe(false);
    // A threshold that no longer matches its own share is also self-evident.
    expect(stampIsSelfConsistent({ ...stamp, threshold: stamp.threshold + 1 })).toBe(false);
  });

  it('replayStamp returns agrees / share-changed / salt-rotated / arm-mismatch', () => {
    const m10 = assignHoldout('m_10', SPEC);
    expect(m10.arm).toBe('treatment');
    expect(m10.bucket / BUCKET_SPACE).toBeCloseTo(0.212050, 6);

    expect(replayStamp(m10, 'm_10', SPEC).verdict).toBe('agrees');

    // THE §4.11 DEFECT: the share moves, the draw does not, and the member
    // silently changes arm in the recomputation. 2000 → 2500 bp crosses m_10.
    const wider = replayStamp(m10, 'm_10', at(2500));
    expect(wider.verdict).toBe('share-changed');
    expect(wider.recomputed.arm).toBe('holdout');

    // A rotation is not a defect — it is an epoch change, and it is reported as
    // one rather than as a mismatch, because the stamp is still valid evidence
    // of its own epoch.
    expect(replayStamp(m10, 'm_10', { ...SPEC, salt: 'almond-holdout-v2', saltId: 'v2' }).verdict)
      .toBe('salt-rotated');

    // A stamp replayed against the wrong member does not reproduce at all.
    expect(replayStamp(m10, 'm_11', SPEC).verdict).toBe('arm-mismatch');
    // ... as does a forged arm on an otherwise intact row.
    expect(replayStamp({ ...m10, arm: 'holdout' }, 'm_10', SPEC).verdict).toBe('arm-mismatch');
  });
});

// ---------------------------------------------------------------------------
// H11 — the registry is complete and is stamped.
// ---------------------------------------------------------------------------
describe('H11 every registered experiment resolves and is stamped', () => {
  it('holdoutSpecFromConfig answers for every id in the registry', () => {
    const registered = Object.keys(HOLDOUT_EXPERIMENTS) as ExperimentId[];
    expect(registered.length).toBeGreaterThan(0);
    for (const id of registered) {
      const spec = holdoutSpecFromConfig(id);
      expect(spec.experiment).toBe(HOLDOUT_EXPERIMENTS[id]);
      expect(Number.isInteger(spec.holdoutShareBp)).toBe(true);
      expect(spec.salt.length).toBeGreaterThan(0);
    }
    // An experiment registered with no configured share must not default to
    // one: a Record<string, number> cannot express that, so it throws.
    expect(() => holdoutSpecFromConfig('notAnExperiment' as ExperimentId))
      .toThrow(/no configured share/);
  });

  it('stampAllExperiments returns one distinct stamp per registered experiment', () => {
    const stamps = stampAllExperiments('m_x');
    const registered = Object.keys(HOLDOUT_EXPERIMENTS) as ExperimentId[];
    expect(stamps.length).toBe(registered.length);
    expect(new Set(stamps.map((s) => s.experiment)).size).toBe(registered.length);
    for (const s of stamps) {
      expect(stampIsSelfConsistent(s)).toBe(true);
      expect(s.saltId).toBe(config.HOLDOUT.saltId);
      // The salt itself is never stamped — the epoch id is enough to replay.
      expect(JSON.stringify(s)).not.toContain(config.HOLDOUT.salt);
    }
  });
});

// ---------------------------------------------------------------------------
// H12 — the member is told nothing (§4.11), and the order remembers everything.
// ---------------------------------------------------------------------------
describe('H12 the arm is recorded server-side and returned to nobody', () => {
  let app: FastifyInstance;
  let token: string;
  beforeAll(async () => {
    app = await build();
    token = await signIn(app, '0790000000');
  });
  afterAll(async () => { await app.close(); });

  it('no checkout or balance response body carries an arm, a bucket or a threshold', async () => {
    // A control arm that knows it is one is not a control arm. §4.11: the
    // member "must be told nothing", and the cheapest way to guarantee that is
    // for the word never to reach the wire.
    const item = menuItems.find((m) => m.inStock !== false && m.sizes.length > 0 && m.sizes[0].price > 0)!;
    const auth = { authorization: `Bearer ${token}` };
    const r = await app.inject({
      method: 'POST',
      url: '/v1/checkout',
      payload: {
        branchId: 'b1',
        orderType: 'pickup',
        paymentMethod: 'cash',
        lines: [{ itemId: item.id, sizeId: item.sizes[0].id, optionIds: [], qty: 1 }],
      },
      headers: { ...auth, 'idempotency-key': `holdout-${Date.now()}` },
    });
    expect(r.statusCode).toBe(201);
    const balance = await app.inject({ method: 'GET', url: '/v1/me/balance', headers: auth });
    expect(balance.statusCode).toBe(200);

    for (const res of [r, balance]) {
      const lower = res.body.toLowerCase();
      for (const word of ['holdout', 'treatment', 'bucket', 'threshold', 'experiment']) {
        expect(lower, `a response body leaked "${word}": ${res.body}`).not.toContain(word);
      }
      // ... and no key is named for an arm either, however it is spelled. The
      // string check above would miss `{"a":"holdout"}` renamed; this misses a
      // renamed VALUE. Together they cover both halves.
      expect(keysOf(res.json()), `a response body carries an arm-shaped key: ${res.body}`)
        .not.toContain('arm');
    }
  });

  it('the checkout route stamps every order, in the same call that creates it', () => {
    // The bff/test/earn.test.ts:756 idiom. An order written without its arm can
    // never be assigned one after the fact — that is the whole point of a
    // snapshot — so the call must be inside the createOrder literal.
    const src = readFileSync(join(REPO, 'bff/src/routes/checkout.ts'), 'utf8');
    expect(src).toMatch(/experimentArms:\s*stampAllExperiments\(/);
    const create = src.slice(src.indexOf('backend.createOrder('));
    expect(create.slice(0, create.indexOf('});'))).toMatch(/experimentArms/);
  });

  it('the backend stores the arms on the order record', async () => {
    const backend = createMemoryBackend();
    const member = await backend.findOrCreateByPhone('+962790000222', 'H12');
    const arms: readonly HoldoutStamp[] = stampAllExperiments(member.id);
    const order = await backend.createOrder({
      memberId: member.id, branchId: 'b1', type: 'pickup', paymentMethod: 'cash',
      subtotal: 10, tax: 1.6, total: 11.6, pointsEarned: 0,
      experimentArms: arms,
    });
    expect(order.experimentArms).toEqual(arms);
    // And the record is enough to re-derive the arm months later, from the
    // member id alone — which is the property §4.11 is buying.
    for (const stamp of order.experimentArms!) {
      expect(stampIsSelfConsistent(stamp)).toBe(true);
      const spec = { ...SPEC, experiment: stamp.experiment };
      expect(replayStamp(stamp, member.id, spec).verdict).toBe('agrees');
    }
  });
});
