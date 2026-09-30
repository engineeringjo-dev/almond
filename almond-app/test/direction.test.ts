import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  applyDocumentDirection,
  documentDirection,
  forwardChevron,
  layoutFollowsLanguage,
  startTextAlign,
} from '@/lib/direction';
import { initI18n } from '@/lib/i18n';
import { useAppStore } from '@/stores/appStore';

// expo-localization reaches a native module on import; only the device
// language is read from it, and D2 sets the language explicitly anyway.
vi.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

/**
 * D1-D3 — THE WEB BUILD READS RIGHT-TO-LEFT IN ARABIC (audit P1).
 *
 * `<html>` shipped as `lang="en"` with no `dir`, because I18nManager.forceRTL
 * does nothing in react-native-web: every row laid out LTR and screen readers
 * used an English voice for Arabic. D1 pins the attributes, D2 that they
 * follow a language switch, D3 that the hand-made flips which used to paper
 * over it do not now mirror a second time.
 */

type FakeDoc = { documentElement: { lang: string; dir: string } };
const fakeDoc = (): FakeDoc => ({ documentElement: { lang: 'en', dir: '' } });

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.get(k) ?? null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
  clear(): void { this.map.clear(); }
}

describe('D1 the document root carries the language and its direction', () => {
  it('Arabic is rtl, English ltr', () => {
    expect(documentDirection('ar')).toEqual({ lang: 'ar', dir: 'rtl' });
    expect(documentDirection('en')).toEqual({ lang: 'en', dir: 'ltr' });
  });

  it('writes them onto <html> (react-native-web is the platform under test)', () => {
    const doc = fakeDoc();
    applyDocumentDirection('ar', doc);
    expect(doc.documentElement).toEqual({ lang: 'ar', dir: 'rtl' });
    applyDocumentDirection('en', doc);
    expect(doc.documentElement).toEqual({ lang: 'en', dir: 'ltr' });
  });
});

describe('D2 a language switch re-points the document', () => {
  const doc = fakeDoc();
  beforeAll(() => {
    (globalThis as unknown as { window: unknown }).window = { localStorage: new MemoryStorage() };
    (globalThis as unknown as { document: FakeDoc }).document = doc;
    initI18n('en');
  });

  it('setLang("ar") → <html lang="ar" dir="rtl">, and back', async () => {
    await useAppStore.getState().setLang('ar');
    expect(doc.documentElement).toEqual({ lang: 'ar', dir: 'rtl' });
    await useAppStore.getState().setLang('en');
    expect(doc.documentElement).toEqual({ lang: 'en', dir: 'ltr' });
  });
});

describe('D3 a manual flip happens only where the layout is not mirrored already', () => {
  it('web: the document direction mirrors, so never flip by hand', () => {
    expect(layoutFollowsLanguage('ar', 'web', false)).toBe(true);
    expect(layoutFollowsLanguage('en', 'web', false)).toBe(true);
  });

  it('native: flip only while I18nManager disagrees with the language (before the reload)', () => {
    expect(layoutFollowsLanguage('ar', 'ios', true)).toBe(true);
    expect(layoutFollowsLanguage('en', 'android', false)).toBe(true);
    expect(layoutFollowsLanguage('ar', 'ios', false)).toBe(false);
    expect(layoutFollowsLanguage('en', 'android', true)).toBe(false);
  });
});

describe('D4 UI text starts where the interface reads from, whatever the string', () => {
  it('web: a physical side (the string keeps dir="auto" for its own word order)', () => {
    expect(startTextAlign('ar', 'web', false)).toBe('right');
    expect(startTextAlign('en', 'web', false)).toBe('left');
    // I18nManager is a no-op on web: whatever it says, the side is the language's.
    expect(startTextAlign('ar', 'web', true)).toBe('right');
  });

  it('native: named through React Native\'s RTL left↔right swap', () => {
    // Layout already mirrored for Arabic: 'left' is the start, drawn on the right.
    expect(startTextAlign('ar', 'ios', true)).toBe('left');
    expect(startTextAlign('en', 'android', false)).toBe('left');
    // Just switched, before the reload: name the physical side directly…
    expect(startTextAlign('ar', 'ios', false)).toBe('right');
    // …or through the swap still in force.
    expect(startTextAlign('en', 'android', true)).toBe('right');
  });
});

describe('D5 a row\'s chevron points forward, drawn not typed', () => {
  it('Arabic reads right-to-left, so forward is left', () => {
    expect(forwardChevron('ar')).toBe('chevron-left');
    expect(forwardChevron('en')).toBe('chevron-right');
  });

  it('ListRow draws the lucide chevron — no bidi-mirrored «‹»/«›» glyph', () => {
    const s = readFileSync(join(__dirname, '..', 'components/ui/ListRow.tsx'), 'utf8');
    expect(s).toMatch(/<Icon name=\{forwardChevron\(lang\)\}/);
    // No glyph as a string literal or as bare JSX text.
    expect(s).not.toMatch(/['"][‹›]['"]|>\s*[‹›]\s*</);
  });
});

describe('D6 the shared Text and the search field align by the interface', () => {
  const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

  it('Text sets textAlign from the language, before the caller\'s style', () => {
    const s = src('components/ui/Text.tsx');
    expect(s).toMatch(/textAlign: startTextAlign\(lang\)/);
    // The caller's `style` and `center` still win (listed after it).
    expect(s.indexOf('startTextAlign(lang)')).toBeLessThan(s.indexOf('center && styles.center'));
  });

  it('the search field starts beside its icon, and draws lucide icons, not emoji', () => {
    const s = src('components/ui/SearchBar.tsx');
    expect(s).toMatch(/textAlign: startTextAlign\(lang\)/);
    expect(s).toMatch(/<Icon name="search"/);
    expect(s).toMatch(/<Icon name="close"/);
    expect(s).not.toMatch(/🔍|✕/);
  });
});
