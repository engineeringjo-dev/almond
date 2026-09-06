import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The static walk that T7, T7c, T8, T24 and T27 are built on.
 *
 * Extracted from bff/test/earn.test.ts and widened — docs/LOYALTY-ODOO-ARCHITECTURE.md
 * §F.0, §G gate 1. The walk used to collect `/\.tsx?$/` under four TypeScript
 * roots. `integrations/` — which today already holds Python and POS JavaScript,
 * including `integrations/pos_meps_apex/static/src/app/payment_meps.js` — was
 * outside it entirely.
 *
 * That is not a gap that announces itself. The moment an Odoo-side earn
 * evaluator appears in Python or in POS JavaScript, T7 does not go red: it keeps
 * passing, green, while a second and a third unguarded implementation of the
 * earn arithmetic exist. T7 is the anti-divergence test; a divergence it cannot
 * see is the one failure mode it was written to prevent.
 */

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Widened by §G gate 1: `integrations` holds the Odoo module tree. */
export const ROOTS = ['almond-app', 'almond-web', 'bff', 'packages', 'integrations'];

/** Widened by §G gate 1: `.py` (Odoo server side) and `.js` (POS client side). */
export const EXT = /\.(tsx?|py|js)$/;

const SKIP_DIRS = new Set([
  'node_modules', '.expo', '.next', 'dist', 'build', 'coverage', '.git',
  'test', '__tests__', '.turbo', '__pycache__',
]);

export type Lang = 'ts' | 'py';

/** Which comment syntax a path uses. `.js` is C-family, same as `.ts`. */
export function langOf(path: string): Lang {
  return path.endsWith('.py') ? 'py' : 'ts';
}

export interface SourceFile {
  /** Repo-relative, POSIX separators. */
  path: string;
  raw: string[];
  /** Same lines with comments blanked out — see stripComments(). */
  code: string[];
  lang: Lang;
}

/**
 * Comments are blanked, not matched. T7 and T8 are about CODE: a line that
 * merely NAMES `COMBO_BONUS_POINTS` or `getDay() === 5` while explaining why it
 * must not be used is not an offender, and several such lines exist today (the
 * earn test's own header among them). §9's checklist grep is a plain grep and
 * does hit them, which is why the checklist and the test disagree there — the
 * test is the authority (§9's own scope note).
 *
 * THE DISPATCH ON `lang` IS THE POINT, and it is why this function grew a
 * second parameter rather than a second branch. Adding a bare '#'-to-end-of-line
 * rule to the single unconditional stripper would blank most of the TSX in the
 * repo: every hex colour literal truncates at its '#', and they are everywhere —
 * almond-app/components/ui/Button.tsx, components/loyalty/Cup.tsx,
 * components/cart/PickupInfo.tsx — plus every SVG url(#…), every private
 * #field, every fragment URL. T7, T8 and T24 would then stop seeing the code
 * they guard AND PASS. The change written to stop tests passing silently would
 * be the thing that makes them pass silently. T27's canary asserts against it.
 */
export function stripComments(lines: string[], lang: Lang): string[] {
  return lang === 'py' ? stripPython(lines) : stripCFamily(lines);
}

/** `//` to end of line and `/* … *\/` blocks. String literals are NOT tracked —
 *  this is the pre-existing behaviour of the walk and is left byte-identical so
 *  that widening the file set is the only variable this gate changes. */
function stripCFamily(lines: string[]): string[] {
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

/**
 * `#` to end of line, plus triple-quoted strings. The docstring handling is not
 * decoration: an `earn.py` docstring explaining POINTS_PER_JOD would otherwise
 * be a T7 offender, and the fix for that would be to delete the explanation.
 *
 * Single-line string literals are tracked only so that a '#' inside one does not
 * eat the rest of the line.
 */
function stripPython(lines: string[]): string[] {
  let fence: '"""' | "'''" | null = null;
  return lines.map((line) => {
    let out = '';
    let quote: '"' | "'" | null = null;
    let i = 0;
    while (i < line.length) {
      if (fence) {
        if (line.startsWith(fence, i)) { i += 3; fence = null; continue; }
        i++;
        continue;
      }
      if (quote) {
        if (line[i] === '\\') { out += '  '; i += 2; continue; }
        if (line[i] === quote) quote = null;
        out += line[i];
        i++;
        continue;
      }
      if (line.startsWith('"""', i) || line.startsWith("'''", i)) {
        fence = line.startsWith('"""', i) ? '"""' : "'''";
        i += 3;
        // A docstring that opens AND closes on this line.
        const end = line.indexOf(fence, i);
        if (end !== -1) { i = end + 3; fence = null; }
        continue;
      }
      if (line[i] === '#') break; // rest of the line
      if (line[i] === '"' || line[i] === "'") quote = line[i] as '"' | "'";
      out += line[i];
      i++;
    }
    return out;
  });
}

export function collectSources(): SourceFile[] {
  const out: SourceFile[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (!SKIP_DIRS.has(entry)) walk(full);
      } else if (EXT.test(entry)) {
        const path = relative(REPO, full).split(sep).join('/');
        const raw = readFileSync(full, 'utf8').split('\n');
        const lang = langOf(path);
        out.push({ path, raw, lang, code: stripComments(raw, lang) });
      }
    }
  };
  for (const root of ROOTS) {
    const full = join(REPO, root);
    // A root that does not exist yet is not silently skipped: T27 asserts on the
    // files it expects to find, so a missing root fails there with a name.
    if (existsSync(full)) walk(full);
  }
  return out;
}
