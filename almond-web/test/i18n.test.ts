import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ar from '../src/messages/ar.json';
import en from '../src/messages/en.json';
import { routing } from '../src/i18n/routing';

/**
 * Guards the bilingual copy (src/messages/{ar,en}.json):
 *   - the two files have exactly the same key tree (a key missing in one locale
 *     renders as the raw key id on that site);
 *   - no empty strings (Arabic is the default locale — an empty value is a
 *     blank button on the home page);
 *   - ICU placeholders match between locales ({code} in one, {promo} in the
 *     other is a runtime FORMATTING_ERROR);
 *   - every literal `t('key')` used in src/ resolves in BOTH files.
 */

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [kk, vv] of flatten(v as Tree, key)) out.set(kk, vv);
    } else {
      out.set(key, v);
    }
  }
  return out;
}

const AR = flatten(ar as Tree);
const EN = flatten(en as Tree);

const placeholders = (s: string) =>
  [...new Set([...s.matchAll(/\{\s*([A-Za-z_]\w*)/g)].map((m) => m[1]))].sort();

describe('messages parity', () => {
  it('the locale list is exactly ar (default) + en, and a messages file exists for each', () => {
    expect([...routing.locales].sort()).toEqual(['ar', 'en']);
    expect(routing.defaultLocale).toBe('ar');
    for (const l of routing.locales) {
      expect(fs.existsSync(path.join(__dirname, '../src/messages', `${l}.json`))).toBe(true);
    }
  });

  it('is non-trivial (sanity: the flattening found the keys)', () => {
    expect(AR.size).toBeGreaterThan(100);
  });

  it('every Arabic key exists in English', () => {
    expect([...AR.keys()].filter((k) => !EN.has(k))).toEqual([]);
  });

  it('every English key exists in Arabic', () => {
    expect([...EN.keys()].filter((k) => !AR.has(k))).toEqual([]);
  });

  it('every leaf is a string', () => {
    const bad = [...AR, ...EN].filter(([, v]) => typeof v !== 'string').map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it('no empty (or whitespace-only) Arabic strings', () => {
    expect([...AR].filter(([, v]) => String(v).trim() === '').map(([k]) => k)).toEqual([]);
  });

  it('no empty (or whitespace-only) English strings', () => {
    expect([...EN].filter(([, v]) => String(v).trim() === '').map(([k]) => k)).toEqual([]);
  });

  it('ICU placeholders are the same set in both locales', () => {
    const mismatched = [...AR.keys()]
      .filter((k) => EN.has(k))
      .filter((k) => placeholders(String(AR.get(k))).join() !== placeholders(String(EN.get(k))).join())
      .map((k) => `${k}: ar{${placeholders(String(AR.get(k)))}} en{${placeholders(String(EN.get(k)))}}`);
    expect(mismatched).toEqual([]);
  });
});

describe('keys used in code exist', () => {
  const SRC = path.join(__dirname, '../src');
  const files = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return files(p);
      return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
    });

  // `const t = useTranslations('Cart')` (or `await getTranslations('Cart')`),
  // then `t('key')` / `t.rich('key')` with a LITERAL key. Dynamic keys
  // (t(`x.${y}`)) are out of scope for a static check.
  const binding = /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*['"]([^'"]+)['"]\s*\)/g;

  const used: Array<{ file: string; key: string }> = [];
  for (const file of files(SRC)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const [, fn, ns] of src.matchAll(binding)) {
      const call = new RegExp(`\\b${fn}(?:\\.rich|\\.raw|\\.markup|\\.has)?\\(\\s*['"]([^'"]+)['"]`, 'g');
      for (const [, key] of src.matchAll(call)) {
        used.push({ file: path.relative(SRC, file), key: `${ns}.${key}` });
      }
    }
  }

  it('found a meaningful number of literal t() calls (sanity)', () => {
    expect(used.length).toBeGreaterThan(200);
  });

  it('every literal t() key resolves in ar.json AND en.json', () => {
    const missing = used
      .filter(({ key }) => !AR.has(key) || !EN.has(key))
      .map(({ file, key }) => `${file}: ${key}`);
    expect(missing).toEqual([]);
  });
});
