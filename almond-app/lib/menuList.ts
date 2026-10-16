import { layout, spacing } from '@/constants/theme';
import type { Lang } from '@/types';
import { FULL_PHOTO_FRAME, type MenuPhotoFrame } from '@almond/shared/menu/photoFrame';
import { MENU_PHOTO_FRAMES } from '@almond/shared/menu/photoFrames.generated';

/** A bounded photo plane keeps copy visible on wide windows and every row
 *  the same height for the catalog's measured getItemLayout model. */
const MAX_MENU_PHOTO_HEIGHT = 192;
export function menuPhotoHeight(windowWidth: number): number {
  const column = (Math.min(windowWidth, layout.contentMaxWidth) - spacing.lg * 2 - spacing.md) / 2;
  return Math.min(Math.max(0, column), MAX_MENU_PHOTO_HEIGHT);
}

/** At narrow widths English labels keep their whole words and touch targets. */
export function shouldWrapOrderTabs(width: number, fontScale: number, lang: Lang): boolean {
  return (lang === 'en' && width < 360) || fontScale > 1.2;
}

/** Presentation metadata for the bundled WebP photos: the square, on each
 *  photo's 512px contain canvas, that hides only its white margin. Measured
 *  from the photos by the one rule in @almond/shared/menu/photoFrame and
 *  written by `npm run menu:frames`, which `menu:pull` runs after it writes the
 *  photos, so the nightly sync ships new photos and their frames together.
 *  The hash test in test/menuList.test.ts still rejects a photo changed by
 *  hand without regenerating. Unknown/remote photos use full contain. */
export type { MenuPhotoFrame } from '@almond/shared/menu/photoFrame';
export { MENU_PHOTO_SOURCE_HASH } from '@almond/shared/menu/photoFrames.generated';
const FULL_PHOTO = FULL_PHOTO_FRAME;

export function menuPhotoFrame(url: string | undefined): MenuPhotoFrame {
  const match = /^\/menu\/(p-\d+)\.webp$/.exec(url ?? '');
  return match ? MENU_PHOTO_FRAMES[match[1]!] ?? FULL_PHOTO : FULL_PHOTO;
}

/** Center anchoring and physical translations preserve the photograph's
 *  left/right pixels in RTL too; logical start/end would move its handle. */
export function menuPhotoPlacement(url: string | undefined, plane: number) {
  const [x, y, side] = menuPhotoFrame(url);
  const size = plane * 512 / side;
  return {
    size,
    translateX: plane * (256 - x - side / 2) / side,
    translateY: plane * (256 - y - side / 2) / side,
  };
}
