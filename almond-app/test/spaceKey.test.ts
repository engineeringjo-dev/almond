import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createSpaceHandlers, spaceAction, type KeyEventLike, type KeyTarget } from '@/lib/spaceKey';

/**
 * K1-K3 — SPACE DOES WHAT THE ROLE PROMISES (WAI-ARIA), ON THE WEB BUILD.
 *
 * react-native-web honours Space only on role="button"; the chips that now say
 * radio/checkbox/tab ignored it (and the page scrolled). The browser half is in
 * e2e/app/design-system.spec.ts; here, the decision and the replay.
 */

function el(tagName: string, attrs: Record<string, string> = {}): KeyTarget & { events: string[]; clicks: number } {
  const node = {
    tagName,
    events: [] as string[],
    clicks: 0,
    getAttribute: (n: string) => attrs[n] ?? null,
    dispatchEvent(e: unknown) { node.events.push(String(e)); return true; },
    click() { node.clicks += 1; },
  };
  return node;
}

function key(k: string, target: unknown, extra: Partial<KeyEventLike> = {}): KeyEventLike & { prevented: boolean } {
  const e = { key: k, target, prevented: false, preventDefault() { e.prevented = true; }, ...extra };
  return e;
}

describe('K1 which elements Space activates', () => {
  it('radio, checkbox, switch and tab roles on a div are replayed as a press', () => {
    for (const role of ['radio', 'checkbox', 'switch', 'tab']) {
      expect(spaceAction(el('DIV', { role })), role).toBe('press');
    }
  });

  it('a link that is a tab (the tab bar) is clicked', () => {
    expect(spaceAction(el('A', { role: 'tab' }))).toBe('click');
  });

  it('buttons (react-native-web handles them), native controls, plain divs and disabled ones are left alone', () => {
    expect(spaceAction(el('DIV', { role: 'button' }))).toBe('none');
    expect(spaceAction(el('BUTTON', { role: 'tab' }))).toBe('none');
    expect(spaceAction(el('INPUT', { role: 'checkbox' }))).toBe('none');
    expect(spaceAction(el('TEXTAREA'))).toBe('none');
    expect(spaceAction(el('DIV'))).toBe('none');
    expect(spaceAction(el('DIV', { role: 'radio', 'aria-disabled': 'true' }))).toBe('none');
    expect(spaceAction({ ...el('DIV', { role: 'radio' }), isContentEditable: true })).toBe('none');
  });
});

describe('K2 the replay', () => {
  const enter = (type: 'keydown' | 'keyup') => `Enter:${type}`;

  it('Space on a radio: no scroll, Enter down on press, Enter up on release — once', () => {
    const { onKeyDown, onKeyUp } = createSpaceHandlers(enter);
    const radio = el('DIV', { role: 'radio' });
    const down = key(' ', radio);
    onKeyDown(down);
    expect(down.prevented).toBe(true);
    expect(radio.events).toEqual(['Enter:keydown']);
    // Holding the key repeats keydown: still no scroll, no second press.
    const held = key(' ', radio, { repeat: true });
    onKeyDown(held);
    expect(held.prevented).toBe(true);
    expect(radio.events).toEqual(['Enter:keydown']);
    onKeyUp(key(' ', radio));
    expect(radio.events).toEqual(['Enter:keydown', 'Enter:keyup']);
  });

  it('a tab link is clicked on release', () => {
    const { onKeyDown, onKeyUp } = createSpaceHandlers(enter);
    const tab = el('A', { role: 'tab' });
    onKeyDown(key(' ', tab));
    expect(tab.clicks).toBe(0);
    onKeyUp(key(' ', tab));
    expect(tab.clicks).toBe(1);
    expect(tab.events).toEqual([]);
  });

  it('other keys, modified Space and a button pass through untouched', () => {
    const { onKeyDown, onKeyUp } = createSpaceHandlers(enter);
    const radio = el('DIV', { role: 'radio' });
    const enterKey = key('Enter', radio);
    onKeyDown(enterKey);
    const shifted = key(' ', radio, { shiftKey: true });
    onKeyDown(shifted);
    onKeyUp(key(' ', radio));
    expect(enterKey.prevented || shifted.prevented).toBe(false);
    expect(radio.events).toEqual([]);

    const button = el('DIV', { role: 'button' });
    const onButton = key(' ', button);
    onKeyDown(onButton);
    expect(onButton.prevented).toBe(false);
    expect(button.events).toEqual([]);
  });

  it('a release on a different element does not fire the first', () => {
    const { onKeyDown, onKeyUp } = createSpaceHandlers(enter);
    const a = el('DIV', { role: 'checkbox' });
    const b = el('DIV', { role: 'checkbox' });
    onKeyDown(key(' ', a));
    onKeyUp(key(' ', b));
    expect(a.events).toEqual(['Enter:keydown']);
    expect(b.events).toEqual([]);
  });
});

describe('K3 installed once, at the app root', () => {
  it('app/_layout calls applySpaceActivation at module load', () => {
    const s = readFileSync(join(__dirname, '..', 'app/_layout.tsx'), 'utf8');
    expect(s).toMatch(/^applySpaceActivation\(\);$/m);
  });
});
