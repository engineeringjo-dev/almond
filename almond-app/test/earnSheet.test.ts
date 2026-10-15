import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { shouldAutoOpenEarnSheet, type AutoOpenInput } from '@/lib/earnSheet';
import { useEarnSheetStore } from '@/stores/earnSheetStore';

/**
 * Q1-Q3 — «اجمع نقاطك» opens by itself on launch (owner, 2026-10-15, after Al
 * Ameed), and from Home's header. The decision is lib/earnSheet.ts; every
 * condition below is one line there and one failing case here.
 */
const OPEN: AutoOpenInput = {
  signedIn: true,
  isGuest: false,
  onboarded: true,
  enabled: true,
  launchedFromLink: false,
  shownThisLaunch: false,
};

describe('Q1 shouldAutoOpenEarnSheet', () => {
  it('a signed-in, onboarded member on a plain launch gets the sheet', () => {
    expect(shouldAutoOpenEarnSheet(OPEN)).toBe(true);
  });

  const CLOSED: [keyof AutoOpenInput, boolean, string][] = [
    ['signedIn', false, 'nobody signed in has no code'],
    ['isGuest', true, 'a guest has no code'],
    ['onboarded', false, 'the welcome comes first'],
    ['enabled', false, 'the member switched it off'],
    ['launchedFromLink', true, 'a link or notification brought them for something else'],
    ['shownThisLaunch', true, 'once per launch, not on every return to Home'],
  ];
  for (const [field, value, why] of CLOSED) {
    it(`stays shut when ${field} is ${String(value)} — ${why}`, () => {
      expect(shouldAutoOpenEarnSheet({ ...OPEN, [field]: value })).toBe(false);
    });
  }
});

describe('Q2 the store', () => {
  it('opening marks the launch, closing keeps the mark', () => {
    const s = useEarnSheetStore;
    s.setState({ visible: false, auto: false, shownThisLaunch: false });
    s.getState().open({ auto: true });
    expect(s.getState()).toMatchObject({ visible: true, auto: true, shownThisLaunch: true });
    s.getState().close();
    expect(s.getState()).toMatchObject({ visible: false, shownThisLaunch: true });
    // A tap on the header button is not an automatic open.
    s.getState().open();
    expect(s.getState().auto).toBe(false);
  });
});

describe('Q3 the wiring', () => {
  const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

  it('Home runs the launch check, the header opens the sheet, the root mounts it once', () => {
    expect(src('app/(tabs)/index.tsx')).toMatch(/useLaunchSheets\(\)/);
    expect(src('hooks/useLaunchSheets.ts')).toMatch(/shouldAutoOpenEarnSheet\(/);
    expect(src('components/home/HomeTopBar.tsx')).toMatch(/openEarnSheet\(\)/);
    expect(src('components/home/HomeTopBar.tsx')).toMatch(/accessibilityLabel=\{t\('earnSheet\.open'\)\}/);
    expect(src('app/_layout.tsx').match(/<EarnQrSheet \/>/g)).toHaveLength(1);
  });

  it('the sheet and the barcode tab draw the code through EarnQr, never their own', () => {
    for (const rel of ['components/pay/EarnQrSheet.tsx', 'app/(tabs)/pay.tsx']) {
      // Comments stripped: the tab's history of the code is prose, not a code path.
      const code = src(rel).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      expect(code, rel).toMatch(/<EarnQr /);
      expect(code, `${rel} must not render a QR of its own`).not.toMatch(/<QRCode|usePosToken/);
    }
  });
});
