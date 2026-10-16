/**
 * npm run menu:frames — measure the menu photo frames from the photos in
 * almond-app/public/menu and write packages/shared/src/menu/photoFrames.generated.ts.
 * menu:pull runs the same function after it writes the photos; run this by
 * hand only after changing a photo by hand. Local files only, no network.
 */
import { writeMenuPhotoFrames } from './menu/photoFrames';

writeMenuPhotoFrames().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
