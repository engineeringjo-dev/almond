import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { spacing } from '@/constants/theme';

/**
 * P1-P3 — THE SMALLER ADVICE OF THE EXPERT PANEL (2026-10-15), held in place.
 */
const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('P1 the thank-you after a visit says where it left the member', () => {
  it('the points added, the balance in points and in money, and the next rung', () => {
    const s = src('components/loyalty/VisitRatingSheet.tsx');
    expect(s).toMatch(/t\('visit\.pointsAdded'/);
    expect(s).toMatch(/t\('visit\.balanceNow', \{[\s\S]*?jodFromPoints\(balance\.points\)/);
    expect(s).toMatch(/tierProgressCopy\(balance, lang\)/);
  });
});

describe('P2 a loading screen shows the shape of the page, not a spinner', () => {
  it('Screen draws skeletons, labelled for a screen reader', () => {
    const s = src('components/ui/Screen.tsx');
    expect(s).not.toMatch(/ActivityIndicator/);
    expect(s).toMatch(/<Skeleton\b/);
    expect(s).toMatch(/accessibilityLabel=\{t\('common\.loading'\)\}/);
  });
});

describe('P3 nothing is left under the raised barcode button', () => {
  it('every screen\'s content ends far enough above the tab bar for the button that rises out of it', () => {
    const rise = Math.abs(Number(/marginTop: (-?\d+)/.exec(src('components/ui/TabBarBarcodeButton.tsx'))?.[1] ?? 0));
    expect(rise, 'the button rises above the tab bar').toBeGreaterThan(0);
    const pad = /content: \{[^}]*paddingBottom: spacing\.xxl \* (\d+)/.exec(src('components/ui/Screen.tsx'));
    expect(pad, 'Screen pads the end of its content').toBeTruthy();
    // The last row scrolls clear of the button, with a margin to spare.
    expect(spacing.xxl * Number(pad![1])).toBeGreaterThanOrEqual(rise + spacing.lg);
  });
});
