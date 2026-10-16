/**
 * The menu photo frames, measured from the photos (CLI: npm run menu:frames,
 * scripts/menu-photo-frames.ts).
 *
 * Reads every `p-*.webp` in almond-app/public/menu, measures its frame with
 * the one rule in packages/shared/src/menu/photoFrame.ts, and writes
 * packages/shared/src/menu/photoFrames.generated.ts with the frames and a hash
 * of the photos they were measured from.
 *
 * `menu:pull` calls writeMenuPhotoFrames() after it writes the photos, so the
 * nightly sync (.github/workflows/menu-sync.yml) commits new photos and their
 * frames together. Run it by hand only after changing a photo by hand.
 *
 * Reads local files only; no network, no Odoo.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { isFullPhotoFrame, measurePhotoFrame, type MenuPhotoFrame } from '../../packages/shared/src/menu/photoFrame';

export const MENU_PHOTO_DIR = join('almond-app', 'public', 'menu');
export const PHOTO_FRAMES_FILE = join('packages', 'shared', 'src', 'menu', 'photoFrames.generated.ts');

/** sorted filenames + NUL + bytes — the hash almond-app/test/menuList.test.ts recomputes. */
export function menuPhotoSourceHash(dir: string, files: string[]): string {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(`${file}\0`);
    hash.update(readFileSync(join(dir, file)));
  }
  return hash.digest('hex');
}

export async function measureMenuPhotoFrames(dir = MENU_PHOTO_DIR): Promise<{
  hash: string; frames: Record<string, MenuPhotoFrame>; photos: number;
}> {
  const files = readdirSync(dir).filter((f) => /^p-\d+\.webp$/.test(f)).sort();
  const frames: Record<string, MenuPhotoFrame> = {};
  for (const file of files) {
    const { data, info } = await sharp(join(dir, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const frame = measurePhotoFrame({ data, width: info.width, height: info.height, channels: 4 });
    if (!isFullPhotoFrame(frame)) frames[file.replace(/\.webp$/, '')] = frame;
  }
  return { hash: menuPhotoSourceHash(dir, files), frames, photos: files.length };
}

export function renderPhotoFrames(hash: string, frames: Record<string, MenuPhotoFrame>): string {
  const rows = Object.entries(frames).map(([id, [x, y, side]]) => `  '${id}': [${x}, ${y}, ${side}],`);
  return `// AUTO-GENERATED — do not edit by hand. Regenerate with: npm run menu:frames
// (menu:pull runs it after writing the photos). The rule:
// packages/shared/src/menu/photoFrame.ts. Photos left out zoom nothing.

import type { MenuPhotoFrame } from './photoFrame';

/** sha256 of almond-app/public/menu/p-*.webp: sorted filenames + NUL + bytes. */
export const MENU_PHOTO_SOURCE_HASH = '${hash}';

export const MENU_PHOTO_FRAMES: Readonly<Record<string, MenuPhotoFrame>> = {
${rows.join('\n')}
};
`;
}

export async function writeMenuPhotoFrames(dir = MENU_PHOTO_DIR, out = PHOTO_FRAMES_FILE): Promise<void> {
  const { hash, frames, photos } = await measureMenuPhotoFrames(dir);
  writeFileSync(out, renderPhotoFrames(hash, frames));
  console.log(`wrote ${out}: ${Object.keys(frames).length} frames from ${photos} photos`);
}
