import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { MENU_PHOTO_SOURCE_HASH, menuPhotoFrame, menuPhotoHeight, menuPhotoPlacement, shouldWrapOrderTabs } from '@/lib/menuList';

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

describe('ML4 bounded photo framing and narrow labels', () => {
  it('caps desktop photos while keeping one uniform plane per viewport', () => {
    expect(menuPhotoHeight(320)).toBe(138);
    expect(menuPhotoHeight(390)).toBe(173);
    expect(menuPhotoHeight(412)).toBe(184);
    expect(menuPhotoHeight(1363)).toBe(192);
    expect(src('components/menu/MenuItemCard.tsx')).toMatch(/height: photoHeight/);
    expect(order).toMatch(/onLayout=\{measure\('pair'\)\}/);
  });

  it('keeps measured product and handle bounds inside their padded frame', () => {
    // Visible envelopes measured from the owned photos; these include a
    // handled glass, a tall seasonal drink and an edge-to-edge food photo.
    const products = [
      { id: 'p-10336', bounds: [53, 100, 407, 438] },
      { id: 'p-12188', bounds: [196, 141, 326, 396] },
      { id: 'p-12182', bounds: [191, 153, 376, 370] },
      { id: 'p-10259', bounds: [0, 190, 512, 448] },
    ];
    for (const { id, bounds: [left, top, right, bottom] } of products) {
      const [x, y, side] = menuPhotoFrame(`/menu/${id}.webp`);
      expect(x, id).toBeLessThanOrEqual(left!);
      expect(y, id).toBeLessThanOrEqual(top!);
      expect(x + side, id).toBeGreaterThanOrEqual(right!);
      expect(y + side, id).toBeGreaterThanOrEqual(bottom!);
      expect(x, id).toBeGreaterThanOrEqual(0);
      expect(y, id).toBeGreaterThanOrEqual(0);
      expect(x + side, id).toBeLessThanOrEqual(512);
      expect(y + side, id).toBeLessThanOrEqual(512);
    }
    const photo = menuPhotoPlacement('/menu/p-12188.webp', 173);
    expect(photo.size).toBeGreaterThan(173);
    expect(src('components/menu/MenuItemCard.tsx')).toMatch(/translateX: photo\.translateX/);
  });

  it('uses full contain for unknown and remote photographs', () => {
    for (const url of [undefined, '/menu/new-photo.webp', 'https://example.com/menu/p-12188.webp']) {
      expect(menuPhotoFrame(url)).toEqual([0, 0, 512]);
      expect(menuPhotoPlacement(url, 173)).toEqual({ size: 173, translateX: 0, translateY: 0 });
    }
  });

  it('gives narrow English and enlarged text two full rows of labels', () => {
    expect(shouldWrapOrderTabs(320, 1, 'en')).toBe(true);
    expect(shouldWrapOrderTabs(390, 1, 'en')).toBe(false);
    expect(shouldWrapOrderTabs(320, 1, 'ar')).toBe(false);
    expect(shouldWrapOrderTabs(390, 1.5, 'ar')).toBe(true);
    expect(order).toMatch(/subTabsWrapped: \{ flexWrap: 'wrap' \}/);
    expect(order).toMatch(/subTabWrapped: \{ flexBasis: '45%'/);
  });

  it('rejects stale frames when a bundled photograph changes', () => {
    const directory = join(__dirname, '..', 'public', 'menu');
    const hash = createHash('sha256');
    for (const file of readdirSync(directory).filter((f) => f.endsWith('.webp')).sort()) {
      hash.update(`${file}\0`);
      hash.update(readFileSync(join(directory, file)));
    }
    expect(hash.digest('hex'), 'refresh measured frames when source photographs change').toBe(MENU_PHOTO_SOURCE_HASH);
  });
});
