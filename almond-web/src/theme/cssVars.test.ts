import { describe, expect, it } from 'vitest';
import { colors } from '@almond/shared/theme';
import { channelVars, hexToChannels, themeVars } from './cssVars';

describe('theme channel variables (Tailwind opacity modifiers)', () => {
  it('converts #RRGGBB to space-separated channels', () => {
    expect(hexToChannels('#6C5CB4')).toBe('108 92 180');
    expect(hexToChannels('#ffffff')).toBe('255 255 255');
    expect(hexToChannels('#000000')).toBe('0 0 0');
  });

  it('refuses any other format instead of emitting a broken colour', () => {
    for (const bad of ['#fff', '6C5CB4', 'rgb(1,2,3)', '#6C5CB4FF', '']) {
      expect(() => hexToChannels(bad), bad).toThrow(/#RRGGBB/);
    }
  });

  it('every --color-x has a --color-x-rgb twin carrying the SAME colour', () => {
    const vars = themeVars as unknown as Record<string, string>;
    const hexes = Object.entries(vars).filter(([k]) => k.startsWith('--color-') && !k.endsWith('-rgb'));
    expect(hexes.length).toBe(16);
    for (const [k, hex] of hexes) {
      expect(channelVars[`${k}-rgb`], k).toBe(hexToChannels(hex));
    }
    expect(channelVars['--color-error-rgb']).toBe(hexToChannels(colors.red));
  });
});
