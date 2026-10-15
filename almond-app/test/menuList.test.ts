import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ML — THE MENU IS ONE LIST UNDER A PINNED SECTION BAR, AND A CHIP LANDS
 * EXACTLY (Dunkin' panel, 2026-10-15). The behaviour is in
 * e2e/app/menu.spec.ts; these hold the three rules it rests on, each the cause
 * of a jump that missed while it was being built.
 */
const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');
const order = src('app/(tabs)/order.tsx');
const styleBlock = (s: string, name: string) => /* the `name: { … }` entry */ (new RegExp(`\\n  ${name}: \\{([^}]*)\\}`).exec(s)?.[1] ?? '');

describe('ML1 the list knows where every section starts', () => {
  it('the bar is row 1 and pinned; the list is given each row\'s place', () => {
    expect(order).toMatch(/stickyHeaderIndices=\{searching \? undefined : \[1\]\}/);
    expect(order).toMatch(/const out: MenuRow\[\] = \[\{ type: 'top', key: 'top' \}\];[\s\S]*?out\.push\(\{ type: 'bar', key: 'bar' \}\);/);
    expect(order).toMatch(/getItemLayout=\{getItemLayout\}/);
    // Without it the list GUESSES the place of rows it has not drawn: a tap on
    // «قطع كيك وحلويات» stopped at «ساندويشات».
  });

  it('rows space themselves with padding, never margin: a measured height is all the room a row takes', () => {
    for (const name of ['menuHeader', 'sectionHead', 'pairRow']) {
      const block = styleBlock(order, name);
      expect(block, name).toBeTruthy();
      expect(block, `${name} has no margin`).not.toMatch(/margin/);
    }
    // Each kind reports its height from screen.
    for (const kind of ['top', 'bar', 'section', 'pair', 'empty']) {
      expect(order, kind).toContain(`onLayout={measure('${kind}')}`);
    }
  });
});

describe('ML2 every tile is one height', () => {
  const card = src('components/menu/MenuItemCard.tsx');
  it('the name keeps room for two lines, scaled with the reader\'s text size', () => {
    expect(card).toMatch(/numberOfLines=\{2\} style=\{\{ minHeight: NAME_LINE \* 2 \* fontScale \}\}/);
    expect(card).toMatch(/const NAME_LINE = 24;/);
    const text = src('components/ui/Text.tsx');
    expect(text, 'NAME_LINE is the bodyBold line').toMatch(/bodyBold: \{[^}]*lineHeight: 24/);
  });

  it('an English tile keeps its second line even when it is empty', () => {
    expect(card).toMatch(/\{lang !== 'ar' \? \(\s*<Text variant="caption"[^>]*>\s*\{other \?\? ' '\}/);
  });
});

describe('ML3 the bar moves only itself', () => {
  it('no scrollIntoView: it scrolls every ancestor and cancelled the jump the same tap started', () => {
    const chips = src('components/menu/CategoryChips.tsx');
    expect(chips.replace(/\/\/.*$/gm, '')).not.toMatch(/scrollIntoView/);
    expect(chips).toMatch(/row\.scrollBy\(\{ left: delta/);
    expect(chips).toMatch(/role="navigation"/);
    expect(chips).toMatch(/navItemA11y\(active, name\)/);
  });
});
