import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { backFallback } from '@/lib/backFallback';

/**
 * U1-U2 — ONE HEADER: «رجوع» AND A TITLE, AND NO LOGO BESIDE IT (expert
 * panel, 2026-10-15: «رأس موحّد وأخفّ … رجوع + عنوان للشاشات الداخلية»).
 */
const APP = join(__dirname, '..');
const code = (file: string): string =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('U1 no logo beside a page title', () => {
  // Where the logo is the content rather than a title's ornament.
  const ALLOWED = new Set([
    'app/index.tsx', // the splash
    'app/(auth)/login.tsx', // the sign-in wordmark
    'app/(tabs)/profile.tsx', // the member's avatar on the profile card
  ]);

  it('only the splash, sign-in, the avatar and Home\'s header carry it', () => {
    const offenders = walk(join(APP, 'app'))
      .map((f) => relative(APP, f))
      .filter((f) => !ALLOWED.has(f) && /<Logo\b/.test(code(join(APP, f))));
    expect(offenders, 'a page title is words; the logo is in Home\'s header').toEqual([]);
    expect(code(join(APP, 'components/home/HomeTopBar.tsx'))).toMatch(/<Logo\b/);
  });
});

describe('U2 every stack screen has a way back, even opened cold', () => {
  it('both stacks draw BackButton with a fallback in the header', () => {
    for (const f of ['app/_layout.tsx', 'app/profile/_layout.tsx']) {
      expect(code(join(APP, f)), f).toMatch(/headerLeft: \(\) => <BackButton fallback=\{backFallback\(/);
    }
  });

  it('a cold link goes to the screen\'s parent, and anything else to Home', () => {
    expect(backFallback('loyalty')).toBe('/(tabs)/rewards');
    // The Rewards tab's other doors (page-division prompt, 2026-10-16).
    expect(backFallback('tiers')).toBe('/(tabs)/rewards');
    expect(backFallback('vouchers')).toBe('/(tabs)/rewards');
    expect(backFallback('profile')).toBe('/(tabs)/profile');
    expect(backFallback('order/[id]')).toBe('/(tabs)/track');
    expect(backFallback('something-new')).toBe('/(tabs)');
  });

  it('BackButton goes back when it can, and to the fallback when it cannot', () => {
    const btn = code(join(APP, 'components/ui/BackButton.tsx'));
    expect(btn).toMatch(/router\.canGoBack\(\) \? router\.back\(\) : router\.replace\(fallback\)/);
  });
});
