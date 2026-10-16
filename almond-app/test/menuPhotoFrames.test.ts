import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FULL_PHOTO_FRAME, PHOTO_CANVAS, PHOTO_PADDING, isFullPhotoFrame, measurePhotoFrame,
} from '@almond/shared/menu/photoFrame';
import { MENU_PHOTO_FRAMES, MENU_PHOTO_SOURCE_HASH } from '@almond/shared/menu/photoFrames.generated';
import { measureMenuPhotoFrames } from '../../scripts/menu/photoFrames';

/**
 * M — THE MENU PHOTO FRAMES ARE MEASURED, NOT KEPT BY HAND.
 *
 * Direction A (#100) shipped a hand-measured frame per menu photo, guarded by
 * a hash of the photos (test/menuList.test.ts). The nightly menu sync rewrites
 * the photos from Odoo and runs the full gate before it commits, so the first
 * photo that changed in Odoo would have failed that hash test and stopped the
 * menu publishing. The frames are now measured from the photos by one rule
 * (packages/shared/src/menu/photoFrame.ts) and written by `menu:pull` in the
 * same run, so a changed photo ships with its new frame.
 *
 * M8 pins the measurement: the generator, run on today's photos, reproduces
 * the committed table and hash. It reproduced all 282 hand-measured frames of
 * #100 byte for byte before they were replaced.
 */

const APP_PHOTOS = join(__dirname, '..', 'public', 'menu');

/** A white RGBA photo with one dark rectangle [x0, y0] to [x1, y1] inclusive. */
function photo(width: number, height: number, box?: [number, number, number, number], value = 0, alpha = 255) {
  const data = new Uint8Array(width * height * 4).fill(255);
  if (box) {
    const [x0, y0, x1, y1] = box;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * width + x) * 4;
        data[i] = value; data[i + 1] = value; data[i + 2] = value; data[i + 3] = alpha;
      }
    }
  }
  return { data, width, height, channels: 4 as const };
}

describe('M the menu photo frame rule', () => {
  it('M1 an all-white photo zooms nothing', () => {
    expect(measurePhotoFrame(photo(512, 512))).toEqual(FULL_PHOTO_FRAME);
    expect(isFullPhotoFrame(FULL_PHOTO_FRAME)).toBe(true);
  });

  it('M2 a square photo: the product box plus 24px, squared on its longer side and centred', () => {
    // Product 100..299 wide (200px), 200..249 tall (50px).
    const [x, y, side] = measurePhotoFrame(photo(512, 512, [100, 200, 299, 249]));
    expect(side).toBe(200 + 2 * PHOTO_PADDING);
    expect(x).toBe(100 - PHOTO_PADDING);
    // Padded rows 176..274 (centre 225), so the square starts at 225 - 124.
    expect(y).toBe(101);
  });

  it('M3 a smaller photo is placed on the 512 contain canvas, edges rounded outward', () => {
    // 400×300 scales by 1.28 and sits 64px down on the canvas.
    const frame = measurePhotoFrame(photo(400, 300, [101, 51, 202, 152]));
    // Left edge 101×1.28 = 129.28 → floor 129; right (203)×1.28 = 259.84 → ceil 260.
    expect(frame[2]).toBe(260 - 129 + 2 * PHOTO_PADDING);
    expect(frame[0]).toBe(129 - PHOTO_PADDING);
  });

  it('M4 a product at the edge: the square is clamped inside the canvas', () => {
    const [x, y, side] = measurePhotoFrame(photo(512, 512, [0, 0, 499, 99]));
    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(side).toBeLessThanOrEqual(PHOTO_CANVAS);
    expect(x + side).toBeLessThanOrEqual(PHOTO_CANVAS);
  });

  it('M5 transparent pixels count as white', () => {
    expect(measurePhotoFrame(photo(512, 512, [100, 100, 200, 200], 0, 0))).toEqual(FULL_PHOTO_FRAME);
  });

  it('M6 the white tolerance is 8/255: 247 is margin, 246 is product', () => {
    expect(measurePhotoFrame(photo(512, 512, [100, 100, 200, 200], 247))).toEqual(FULL_PHOTO_FRAME);
    expect(measurePhotoFrame(photo(512, 512, [100, 100, 200, 200], 246))).not.toEqual(FULL_PHOTO_FRAME);
  });

  it('M7 the committed frames are squares inside the canvas', () => {
    for (const [id, [x, y, side]] of Object.entries(MENU_PHOTO_FRAMES)) {
      expect(x >= 0 && y >= 0 && x + side <= PHOTO_CANVAS && y + side <= PHOTO_CANVAS, id).toBe(true);
    }
  });
});

describe('M the generator and the committed table agree', () => {
  it('M8 measuring today\'s photos reproduces the committed frames and hash (run npm run menu:frames)', async () => {
    const measured = await measureMenuPhotoFrames(APP_PHOTOS);
    expect(measured.hash).toBe(MENU_PHOTO_SOURCE_HASH);
    expect(measured.frames).toEqual(MENU_PHOTO_FRAMES);
  }, 60_000);

  it('M9 a photo that changes in Odoo gets its new frame from the same run, no hand step', async () => {
    // The nightly sync, in miniature: copy the photos, replace one with another
    // product's photo, measure. The hash moves and the frame follows the photo.
    const dir = mkdtempSync(join(tmpdir(), 'menu-frames-'));
    try {
      for (const f of readdirSync(APP_PHOTOS)) copyFileSync(join(APP_PHOTOS, f), join(dir, f));
      const a = 'p-10144';
      const b = Object.keys(MENU_PHOTO_FRAMES).find((id) =>
        JSON.stringify(MENU_PHOTO_FRAMES[id]) !== JSON.stringify(MENU_PHOTO_FRAMES[a]))!;
      copyFileSync(join(APP_PHOTOS, `${b}.webp`), join(dir, `${a}.webp`));
      const measured = await measureMenuPhotoFrames(dir);
      expect(measured.hash).not.toBe(MENU_PHOTO_SOURCE_HASH);
      expect(measured.frames[a]).toEqual(MENU_PHOTO_FRAMES[b]);
      expect(measured.frames[a]).not.toEqual(MENU_PHOTO_FRAMES[a]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
