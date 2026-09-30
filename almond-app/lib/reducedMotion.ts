import { AccessibilityInfo, Platform } from 'react-native';

/**
 * REDUCE MOTION / REMOVE ANIMATIONS, READ ONCE FOR THE WHOLE APP.
 *
 * iOS «Reduce Motion», Android «Remove animations» and the browser's
 * `prefers-reduced-motion` were never read (audit P2): menu tiles rose in, the
 * item sheet sprang up, the toast bounced and loops pulsed regardless. Motion
 * that moves things is replaced by an instant change or a plain fade.
 *
 * One store, one platform subscription, however many components ask —
 * react-native-web keys its AccessibilityInfo handlers by the function's
 * SOURCE TEXT, so a subscription per component would collide on removal.
 */

export interface MotionSource {
  isReduceMotionEnabled(): Promise<boolean>;
  addEventListener(
    event: 'reduceMotionChanged',
    handler: (reduced: boolean) => void,
  ): { remove(): void } | undefined | void;
}

export interface MotionStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): boolean;
}

export function createReducedMotionStore(source: MotionSource, initial = false): MotionStore {
  let value = initial;
  let started = false;
  const listeners = new Set<() => void>();
  const set = (next: boolean) => {
    if (next === value) return;
    value = next;
    listeners.forEach((l) => l());
  };
  const start = () => {
    started = true;
    source.isReduceMotionEnabled().then(set, () => {});
    source.addEventListener('reduceMotionChanged', set);
  };
  return {
    subscribe(listener) {
      if (!started) start();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => value,
  };
}

/** Web: the media query answers synchronously, so the first frame is right. */
function initialPreference(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const reducedMotion = createReducedMotionStore(AccessibilityInfo, initialPreference());
