import { describe, it, expect } from 'vitest';

import { inputTextAlign } from '@/lib/inputAlign';

/**
 * A1 — A TEXT FIELD STARTS WHERE THE UI READS FROM (audit P2).
 * The promo field was `textAlign: 'left'`; on the web export the empty car
 * field also sat left (react-native-web's <input dir="auto">). Pinned per
 * platform, because native swaps left/right while its layout is RTL.
 */
describe('A1 inputTextAlign', () => {
  it('web: right in Arabic, left in English', () => {
    expect(inputTextAlign('ar', 'web', false)).toBe('right');
    expect(inputTextAlign('en', 'web', false)).toBe('left');
    // the native flag means nothing on the web
    expect(inputTextAlign('ar', 'web', true)).toBe('right');
  });
  it('native with an RTL layout: pre-swapped, so it lands on the start edge', () => {
    expect(inputTextAlign('ar', 'ios', true)).toBe('left'); // RN swaps → right
    expect(inputTextAlign('en', 'android', true)).toBe('right'); // → left
  });
  it('native with an LTR layout: as is', () => {
    expect(inputTextAlign('ar', 'android', false)).toBe('right');
    expect(inputTextAlign('en', 'ios', false)).toBe('left');
  });
});
