import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * N1-N2 — THE CART IS A SCREEN YOU CAN LEAVE (audit P1).
 *
 * It was a hidden tab (`href: null`): no back control, no highlighted tab, no
 * iOS edge-swipe, and Android Back followed the tab navigator instead of
 * returning to the menu. It is now a stack screen pushed above the tabs, with
 * a drawn back button; `/cart` resolves to it exactly as before, so every deep
 * link and push keeps working.
 */
const root = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('N1 the cart lives on the root stack, not in the tab bar', () => {
  it('app/cart.tsx is the route; there is no hidden tab left behind', () => {
    expect(existsSync(join(root, 'app/cart.tsx'))).toBe(true);
    expect(existsSync(join(root, 'app/(tabs)/cart.tsx'))).toBe(false);
    expect(read('app/_layout.tsx')).toMatch(/<Stack\.Screen name="cart" \/>/);
    expect(read('app/(tabs)/_layout.tsx')).not.toMatch(/name="cart"/);
  });

  it('every entry point goes to /cart — no stale /(tabs)/cart', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e.name) && readFileSync(full, 'utf8').includes("'/(tabs)/cart'")) offenders.push(full);
      }
    };
    for (const d of ['app', 'components', 'lib', 'hooks', 'stores']) walk(join(root, d));
    expect(offenders).toEqual([]);
  });
});

describe('N2 it has a way back', () => {
  it('the cart draws a back button, in the full and the empty state', () => {
    const matches = read('app/cart.tsx').match(/<BackButton fallback="\/\(tabs\)\/order" \/>/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it('the back button is named and falls back when there is no history', () => {
    const s = read('components/ui/BackButton.tsx');
    expect(s).toMatch(/accessibilityLabel=\{t\('common\.back'\)\}/);
    expect(s).toMatch(/router\.canGoBack\(\) \? router\.back\(\) : router\.replace\(fallback\)/);
  });
});
