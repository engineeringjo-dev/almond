import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * G1-G2 — TOUCH TARGETS AND THE TYPE FLOOR HOLD ON THE WEB TOO (audit P2).
 *
 * hitSlop extends a target on iOS/Android only; react-native-web ignores it,
 * so the SIZE itself must reach 44 pt (HIG) / 48 dp (Material, where the
 * 44 px visual sits inside react-navigation's padding). The e2e spec measures
 * the rendered boxes; this pins the style values that produce them.
 */

const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');
const styleBlock = (s: string, name: string) => {
  const start = s.indexOf(`  ${name}: {`);
  if (start < 0) throw new Error(`no style ${name}`);
  return s.slice(start, s.indexOf('},', start));
};
const num = (block: string, prop: string) => Number(new RegExp(`\\b${prop}:\\s*(\\d+)`).exec(block)?.[1]);

describe('G1 ≥44 without hitSlop', () => {
  it('the stepper buttons', () => {
    const b = styleBlock(src('components/ui/Stepper.tsx'), 'btn');
    expect(num(b, 'width')).toBeGreaterThanOrEqual(44);
    expect(num(b, 'height')).toBeGreaterThanOrEqual(44);
  });

  it('the item sheet\'s option and pairing chips', () => {
    const s = src('components/menu/ItemModal.tsx');
    expect(num(styleBlock(s, 'optChip'), 'minHeight')).toBeGreaterThanOrEqual(44);
    expect(num(styleBlock(s, 'pairChip'), 'minHeight')).toBeGreaterThanOrEqual(44);
  });

  it('category chips, the Order sub-tabs and the search clear button', () => {
    expect(num(styleBlock(src('components/menu/CategoryChips.tsx'), 'chip'), 'minHeight')).toBeGreaterThanOrEqual(44);
    expect(num(styleBlock(src('app/(tabs)/order.tsx'), 'subTab'), 'minHeight')).toBeGreaterThanOrEqual(44);
    const clear = styleBlock(src('components/ui/SearchBar.tsx'), 'clear');
    expect(num(clear, 'width')).toBeGreaterThanOrEqual(44);
    expect(num(clear, 'height')).toBeGreaterThanOrEqual(44);
  });
});

describe('G2 the barcode tab reads like its siblings', () => {
  it('its label is 11 pt, the tab bar\'s size (iOS floor), not 10', () => {
    const label = styleBlock(src('components/ui/TabBarBarcodeButton.tsx'), 'label');
    const bar = src('app/(tabs)/_layout.tsx');
    const barSize = Number(/tabBarLabelStyle:[\s\S]*?fontSize:\s*(\d+)/.exec(bar)?.[1]);
    expect(num(label, 'fontSize')).toBeGreaterThanOrEqual(11);
    expect(num(label, 'fontSize')).toBe(barSize);
  });
});
