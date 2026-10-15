import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * I1-I2 — THE ITEM SHEET OPENS ON ITS PHOTOGRAPH AND ENDS ON ONE FILLED BUTTON
 * (expert panel, 2026-10-15: the photo was a 112pt thumbnail, about a fifth of
 * the width, and «أضف للسلة» was an outline weaker than the bar above it).
 */
const sheet = readFileSync(join(__dirname, '..', 'components/menu/ItemModal.tsx'), 'utf8');

describe('I1 the photograph is the first thing', () => {
  it('full width and at least 200pt tall', () => {
    const hero = /hero: \{([\s\S]*?)\n {2}\},/.exec(sheet)?.[1] ?? '';
    expect(hero, 'the hero style').toBeTruthy();
    expect(hero).toMatch(/alignSelf: 'stretch'/);
    const height = Number(/height: (\d+)/.exec(hero)?.[1] ?? 0);
    expect(height).toBeGreaterThanOrEqual(200);
  });
});

describe('I2 «أضف للسلة» is the one filled button, pinned under the sheet', () => {
  it('lives in the sheet\'s footer, as a primary Button', () => {
    const footer = /footer=\{([\s\S]*?)\n {6}\}\n {4}>/.exec(sheet)?.[1] ?? '';
    expect(footer, 'the BottomSheet footer').toBeTruthy();
    const button = /<Button\b[^>]*t\('menu\.addToCart'\)[^>]*\/>/.exec(footer)?.[0] ?? '';
    expect(button, 'the add-to-cart button is in the footer').toBeTruthy();
    // Primary is the default variant: filled ink, 52pt (components/ui/Button).
    expect(button).not.toMatch(/variant=/);
  });
});
