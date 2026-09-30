import { useSyncExternalStore } from 'react';

import { reducedMotion } from '@/lib/reducedMotion';

/** True when the person asked the OS/browser for less motion. See lib/reducedMotion.ts. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(reducedMotion.subscribe, reducedMotion.getSnapshot, reducedMotion.getSnapshot);
}
