import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FEATURED_GIFT_DESIGN_ID,
  GIFT_DESIGNS,
  GIFT_OCCASIONS,
  giftDesignById,
  giftDesignsFor,
} from '@almond/shared/gifts';

const repo = path.resolve(__dirname, '../..');
const read = (p: string) => readFileSync(path.join(repo, p));
const ARABIC = /[؀-ۿ]/;

describe('gift designs: the Vector Cards R1 set', () => {
  it('eleven designs — five Arabic, six English — with unique ids and print codes', () => {
    expect(GIFT_DESIGNS).toHaveLength(11);
    expect(GIFT_DESIGNS.filter((d) => d.lang === 'ar')).toHaveLength(5);
    expect(new Set(GIFT_DESIGNS.map((d) => d.id)).size).toBe(11);
    expect(new Set(GIFT_DESIGNS.map((d) => d.code)).size).toBe(11);
    for (const d of GIFT_DESIGNS) expect(d.id).toBe(d.code.toLowerCase());
  });

  it('each phrase is in its card language and its gloss in the other', () => {
    for (const d of GIFT_DESIGNS) {
      expect(ARABIC.test(d.phrase), d.id).toBe(d.lang === 'ar');
      expect(ARABIC.test(d.gloss), d.id).toBe(d.lang === 'en');
      expect(d.bg).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('every occasion shown has cards in both languages, and every card has a shown occasion', () => {
    for (const o of GIFT_OCCASIONS) {
      const langs = new Set(GIFT_DESIGNS.filter((d) => d.occasion === o.id).map((d) => d.lang));
      expect([...langs].sort(), o.id).toEqual(['ar', 'en']);
      expect(o.titleAr.trim() && o.titleEn.trim()).toBeTruthy();
    }
    for (const d of GIFT_DESIGNS) expect(GIFT_OCCASIONS.map((o) => o.id)).toContain(d.occasion);
  });

  it("lists the reader's language first", () => {
    expect(giftDesignsFor('birthday', 'ar').map((d) => d.id)).toEqual(['ar03', 'en03']);
    expect(giftDesignsFor('birthday', 'en').map((d) => d.id)).toEqual(['en03', 'ar03']);
  });

  it('an old designId still renders a real card', () => {
    expect(giftDesignById('en05').id).toBe('en05');
    // The app's generated designs and the website's bare occasions.
    expect(giftDesignById('anytime-treat').id).toBe('ar01');
    expect(giftDesignById('birthday-cake').id).toBe('ar03');
    expect(giftDesignById('thankyou').id).toBe('ar02');
    // Occasions this set does not cover, and nothing at all.
    expect(giftDesignById('eid-mubarak').id).toBe(FEATURED_GIFT_DESIGN_ID);
    expect(giftDesignById(undefined).id).toBe(FEATURED_GIFT_DESIGN_ID);
  });

  it('every design has its artwork in the app and on the website — the same file', () => {
    const artMap = read('almond-app/lib/giftArt.ts').toString();
    for (const d of GIFT_DESIGNS) {
      expect(artMap, `${d.id} missing from lib/giftArt.ts`).toContain(
        `${d.id}: require('../assets/gift-cards/${d.id}.webp')`,
      );
      const app = `almond-app/assets/gift-cards/${d.id}.webp`;
      const web = `almond-web/public/gift-cards/${d.id}.webp`;
      expect(existsSync(path.join(repo, app)), app).toBe(true);
      expect(existsSync(path.join(repo, web)), web).toBe(true);
      expect(read(app).equals(read(web)), `${d.id}: app and web artwork differ`).toBe(true);
    }
  });
});
