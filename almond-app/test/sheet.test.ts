import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { layout } from '@almond/shared/theme';
import {
  dragOffset,
  shouldDismissSheet,
  SHEET_DISMISS_DISTANCE,
  SHEET_MAX_LIFT,
} from '@/lib/sheetGesture';

/**
 * S1-S3 — THE BOTTOM SHEET IS A NAMED DIALOG YOU CAN CLOSE (audit P2).
 *
 * axe: aria-dialog-name (serious) on the item sheet. No visible close control
 * (onRequestClose is Android Back / web Escape only). A grabber that did
 * nothing. Full width on a desktop: ~700 px size segments, a 1,400 px CTA.
 */

const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('S1 drag to dismiss', () => {
  it('a long drag dismisses, even if it ends still', () => {
    expect(shouldDismissSheet(SHEET_DISMISS_DISTANCE, 0)).toBe(true);
    expect(shouldDismissSheet(SHEET_DISMISS_DISTANCE - 1, 0)).toBe(false);
  });

  it('a short quick flick dismisses', () => {
    expect(shouldDismissSheet(30, 0.5)).toBe(true);
  });

  it('jitter, a slow short drag and an upward flick do not', () => {
    expect(shouldDismissSheet(4, 2)).toBe(false);
    expect(shouldDismissSheet(40, 0.05)).toBe(false);
    expect(shouldDismissSheet(-60, -1)).toBe(false);
  });

  it('down follows the finger; up is damped and capped', () => {
    expect(dragOffset(50)).toBe(50);
    expect(dragOffset(0)).toBe(0);
    expect(dragOffset(-16)).toBeCloseTo(-8, 5);
    expect(dragOffset(-10_000)).toBe(-SHEET_MAX_LIFT);
  });
});

describe('S2 the sheet names itself and can be closed', () => {
  const s = src('components/ui/BottomSheet.tsx');

  it('the dialog takes the title, else the label, as its name', () => {
    expect(s).toMatch(/aria-label=\{title \?\? label\}/);
  });

  it('a visible close button, named in the reader\'s language, a full touch target', () => {
    expect(s).toMatch(/accessibilityLabel=\{t\('common\.close'\)\}/);
    const block = s.slice(s.indexOf('  close: {'), s.indexOf('},', s.indexOf('  close: {')));
    expect(block).toMatch(/width: MIN_TOUCH_TARGET/);
    expect(block).toMatch(/height: MIN_TOUCH_TARGET/);
  });

  it('the grabber area carries the pan handlers', () => {
    expect(s).toMatch(/\{\.\.\.pan\.panHandlers\}/);
    expect(s).toMatch(/shouldDismissSheet\(g\.dy, g\.vy\)/);
  });

  it('every sheet without a title passes a label', () => {
    expect(src('components/menu/ItemModal.tsx')).toMatch(/<BottomSheet[\s\S]*?label=\{/);
    expect(src('components/order/RatingSheet.tsx')).toMatch(/label=\{t\('track\.rateTitle'/);
  });
});

describe('S3 wide windows get a centred sheet, not a stretched one', () => {
  it('capped at the shared sheet width', () => {
    expect(layout.sheetMaxWidth).toBeGreaterThanOrEqual(480);
    expect(layout.sheetMaxWidth).toBeLessThanOrEqual(640);
    const s = src('components/ui/BottomSheet.tsx');
    expect(s).toMatch(/maxWidth: layout\.sheetMaxWidth/);
    expect(s).toMatch(/dock: \{[^}]*alignItems: 'center'/);
  });
});
