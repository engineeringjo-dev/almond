import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * ID1-ID5 — THE IDENTITY IN THE CODE, not only in the palette (theme.test.ts).
 *
 * Owner, 2026-10-15: «اعمل الهوية اسود وابيض كالشعار … الغي البنفسجي
 * والايموجي». A palette can be black and white while a screen still carries a
 * hardcoded violet, a gradient or a ☕ in a string; these walk the sources.
 */
const APP = join(__dirname, '..');
const REPO = join(APP, '..');

/** Comments removed — a tombstone that quotes the deleted emoji or colour is
 *  documentation, not a violation (the same stripper as C15). */
const code = (file: string): string =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

const APP_DIRS = ['app', 'components', 'lib', 'hooks', 'stores', 'services', 'constants'].map((d) => join(APP, d));
const SOURCES = [
  ...APP_DIRS.flatMap((d) => walk(d)),
  ...walk(join(REPO, 'almond-web', 'src')),
  ...walk(join(REPO, 'packages', 'shared', 'src')),
];
const rel = (f: string) => relative(REPO, f);

describe('ID1 no emoji in any source string', () => {
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|\u{FE0F}/u;
  it('the app, the website and the shared package', () => {
    const offenders: string[] = [];
    for (const f of SOURCES) {
      code(f).split('\n').forEach((line, i) => {
        if (EMOJI.test(line)) offenders.push(`${rel(f)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders, 'an icon from components/ui/Icon.tsx (or lucide on the web), never a glyph').toEqual([]);
  });
});

describe('ID2 no gradient anywhere', () => {
  it('nothing imports expo-linear-gradient, and the website has no gradient class', () => {
    const offenders = SOURCES.filter((f) => /expo-linear-gradient|bg-gradient-|linear-gradient\(/.test(code(f))).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('ID3 no colour typed into a screen', () => {
  // The palette is the only source of a colour. What a screen may still
  // write: translucent white over the black card (it is dark in both
  // schemes), the QR code's own black-on-white, and the dark veil over it.
  const ALLOWED = [
    /rgba\(255,\s*255,\s*255,\s*0?\.\d+\)/g,
    /rgba\(17,\s*17,\s*17,\s*0?\.\d+\)/g,
    /<QRCode[^>]*color="#000000" backgroundColor="#FFFFFF"/g,
  ];
  const LITERAL = /['"]#[0-9A-Fa-f]{3,8}['"]|rgba?\(/;
  it('almond-app screens and components', () => {
    const offenders: string[] = [];
    for (const f of [join(APP, 'app'), join(APP, 'components')].flatMap((d) => walk(d))) {
      code(f).split('\n').forEach((line, i) => {
        const rest = ALLOWED.reduce((l, re) => l.replace(re, ''), line);
        if (LITERAL.test(rest)) offenders.push(`${rel(f)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders, 'use colors.* from constants/theme — a literal is the same in both schemes').toEqual([]);
  });
});

describe('ID4 the app follows the phone\'s light or dark setting', () => {
  it('the palette is picked from Appearance, and the app declares it supports both', () => {
    expect(code(join(APP, 'constants', 'theme.ts'))).toMatch(/export const colors = paletteFor\(colorScheme\)/);
    expect(code(join(APP, 'constants', 'theme.ts'))).toMatch(/Appearance\.getColorScheme\(\) === 'dark'/);
    const appJson = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')) as { expo: { userInterfaceStyle: string } };
    expect(appJson.expo.userInterfaceStyle).toBe('automatic');
  });

  it('no screen reaches past it to the shared light palette', () => {
    const offenders = APP_DIRS.flatMap((d) => walk(d))
      .filter((f) => !f.endsWith(join('constants', 'theme.ts')))
      .filter((f) => /from '@almond\/shared\/theme'/.test(code(f)))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('ID5 white text only where white is right in both schemes', () => {
  // `colors.white` is literal white. On an ink fill it is white on near-white
  // in dark mode — that is what `colors.onInk` is for. It stays only on a
  // photograph's scrim (the sold-out veil), which is dark in both schemes.
  it('the one text use is the sold-out veil', () => {
    const uses: string[] = [];
    for (const f of [join(APP, 'app'), join(APP, 'components')].flatMap((d) => walk(d))) {
      code(f).split('\n').forEach((line, i) => {
        if (/color=\{colors\.white\}/.test(line)) uses.push(`${rel(f)}:${i + 1}`);
      });
    }
    expect(uses).toHaveLength(1);
    expect(uses[0]).toMatch(/components\/menu\/MenuItemCard\.tsx/);
  });
});
