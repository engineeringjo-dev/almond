/**
 * THE MENU PHOTO FRAME — one rule, measured from the photograph itself.
 *
 * The menu shows each Odoo product photo on a square plane. Most photos carry a
 * wide white margin around the product, so the plane zooms in on the product:
 * the frame is the smallest square, on the photo's 512px "contain" canvas, that
 * encloses every pixel more than 8/255 away from white, plus 24px of padding.
 * Only the white margin is hidden; the photograph itself is never altered.
 *
 * Direction A («Daylight Counter», #100) measured these frames once by hand and
 * guarded them with a hash of the photos. The nightly menu sync rewrites the
 * photos from Odoo, so the first changed photo failed the sync's gate and the
 * menu stopped publishing. Now `npm run menu:frames` (called by `menu:pull`)
 * measures every frame with this function and writes
 * `photoFrames.generated.ts` in the same run. The function reproduces all 282
 * hand-measured frames exactly (test M8 in almond-app/test/menuPhotoFrames.test.ts).
 */

/** [x, y, side] on the 512px contain canvas. */
export type MenuPhotoFrame = readonly [x: number, y: number, side: number];

export const PHOTO_CANVAS = 512;
export const PHOTO_PADDING = 24;
/** A pixel counts as product when it is more than this far from white (0–255). */
export const PHOTO_WHITE_TOLERANCE = 8;
/** The whole canvas: no zoom. Frames equal to this are not written down. */
export const FULL_PHOTO_FRAME: MenuPhotoFrame = [0, 0, PHOTO_CANVAS];

export interface DecodedPhoto {
  /** Raw pixels, row by row, `channels` bytes each (RGB or RGBA). */
  data: Uint8Array;
  width: number;
  height: number;
  channels: 3 | 4;
}

/**
 * The frame for one decoded photograph. Transparent pixels count as white.
 * Edges are rounded outward (the box never cuts a product pixel), the padded
 * box is clamped to the canvas, and the square is centred on it and kept
 * inside the canvas.
 */
export function measurePhotoFrame({ data, width, height, channels }: DecodedPhoto): MenuPhotoFrame {
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const alpha = channels === 4 ? data[i + 3]! / 255 : 1;
      const darkest = Math.min(data[i]!, data[i + 1]!, data[i + 2]!);
      // Composited over white: a transparent pixel is white.
      const onWhite = 255 - (255 - darkest) * alpha;
      if (255 - onWhite > PHOTO_WHITE_TOLERANCE) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return FULL_PHOTO_FRAME;

  const scale = PHOTO_CANVAS / Math.max(width, height);
  const offsetX = (PHOTO_CANVAS - width * scale) / 2;
  const offsetY = (PHOTO_CANVAS - height * scale) / 2;
  const x0 = Math.max(0, Math.floor(offsetX + minX * scale) - PHOTO_PADDING);
  const y0 = Math.max(0, Math.floor(offsetY + minY * scale) - PHOTO_PADDING);
  const x1 = Math.min(PHOTO_CANVAS, Math.ceil(offsetX + (maxX + 1) * scale) + PHOTO_PADDING);
  const y1 = Math.min(PHOTO_CANVAS, Math.ceil(offsetY + (maxY + 1) * scale) + PHOTO_PADDING);
  const side = Math.max(x1 - x0, y1 - y0);
  const place = (lo: number, hi: number) =>
    Math.floor(Math.min(Math.max(0, (lo + hi) / 2 - side / 2), PHOTO_CANVAS - side));
  return [place(x0, x1), place(y0, y1), side];
}

/** True when a frame zooms nothing, so the table can leave it out. */
export function isFullPhotoFrame(frame: MenuPhotoFrame): boolean {
  return frame[0] === 0 && frame[1] === 0 && frame[2] === PHOTO_CANVAS;
}
