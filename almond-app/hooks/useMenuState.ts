import { useSyncExternalStore } from 'react';
import { getMenu, onMenuChange, type MenuState } from '@almond/shared/menu/store';

/** The menu in use, re-rendering when a newer one arrives from the server
 *  (services/menuSync.ts). For anything derived from the menu outside
 *  react-query — the object changes identity exactly when the menu does. */
export function useMenuState(): MenuState {
  return useSyncExternalStore(
    (cb) => onMenuChange(() => cb()),
    getMenu,
    getMenu,
  );
}
