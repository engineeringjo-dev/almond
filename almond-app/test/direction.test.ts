import { describe, it, expect, beforeAll, vi } from 'vitest';

import { applyDocumentDirection, documentDirection, layoutFollowsLanguage } from '@/lib/direction';
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
