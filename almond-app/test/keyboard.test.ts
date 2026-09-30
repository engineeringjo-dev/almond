import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * K1 — THE KEYBOARD DOES NOT COVER THE CART'S FIELDS (audit P2).
 *
 * The promo and car-info inputs live in <Screen>'s scroll view; nothing lifted
 * them above the keyboard, and a tap on «تطبيق» with the keyboard up only
 * closed the keyboard. The keyboard is native-only (the web export has none to
 * drive), so this guards the wiring in the source, the way C7e guards the
 * reward board: remove it and this fails.
 */
const src = (rel: string) =>
  readFileSync(join(__dirname, '..', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('K1 the shared screen avoids the keyboard', () => {
  const screen = src('components/ui/Screen.tsx');

  it('wraps the scroll view in a KeyboardAvoidingView that pads on native', () => {
    const kav = screen.indexOf('<KeyboardAvoidingView');
    const scroll = screen.indexOf('<ScrollView');
    expect(kav).toBeGreaterThan(-1);
    expect(scroll).toBeGreaterThan(kav);
    expect(screen.indexOf('</KeyboardAvoidingView>')).toBeGreaterThan(screen.indexOf('</ScrollView>'));
    expect(screen).toMatch(/behavior=\{Platform\.OS === 'web' \? undefined : 'padding'\}/);
  });

  it('lets a tap land while the keyboard is up', () => {
    expect(screen).toMatch(/keyboardShouldPersistTaps="handled"/);
  });

  it('the cart renders its fields inside <Screen> (so they get it)', () => {
    const cart = src('app/cart.tsx');
    // The full cart (the last <Screen>; the first is the empty state).
    const open = cart.lastIndexOf('<Screen>');
    const close = cart.lastIndexOf('</Screen>');
    for (const field of ['<PromoInput', 'style={[styles.carInput']) {
      const at = cart.indexOf(field);
      expect(at, field).toBeGreaterThan(open);
      expect(at, field).toBeLessThan(close);
    }
  });
});
