import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { ltrIsolate } from '@almond/shared/lib/phone';

/**
 * BD — A PHONE NUMBER READS LEFT TO RIGHT INSIDE AN ARABIC SENTENCE.
 *
 * «أرسلنا رمزاً مكوّناً من 6 أرقام إلى +962791234567» rendered as «…إلى
 * 962791234567+»: the "+" is a weak character and settles at the far end of a
 * right-to-left line (the Arabic expert, in Chromium, 2026-10-15). The number
 * is wrapped in U+2066 … U+2069, one helper for the app and the website.
 */
const APP = join(__dirname, '..');
const WEB = join(APP, '..', 'almond-web', 'src');
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : files(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });

describe('BD1 the helper', () => {
  it('wraps the run in a left-to-right isolate', () => {
    expect(ltrIsolate('+962791234567')).toBe('⁦+962791234567⁩');
  });
});

describe('BD2 every phone a sentence carries is isolated', () => {
  it('in the app and on the website', () => {
    const sites: string[] = [];
    const offenders: string[] = [];
    for (const file of [...files(join(APP, 'app')), ...files(join(APP, 'components')), ...files(WEB)]) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'[^']+',\s*\{([^}]*\bphone\b[^}]*)\}/g)) {
        sites.push(file);
        if (!/\bphone:\s*ltrIsolate\(/.test(m[1]!)) offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(sites.length, 'the scan must find the OTP and details lines').toBeGreaterThanOrEqual(3);
    expect(offenders).toEqual([]);
  });

  it('and the help screen prints the call-centre number the same way', () => {
    expect(readFileSync(join(APP, 'app/profile/help.tsx'), 'utf8').match(/ltrIsolate\(contact\.display\)/g)).toHaveLength(2);
  });
});
