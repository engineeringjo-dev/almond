import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReducedMotionStore, type MotionSource } from '@/lib/reducedMotion';

/**
 * M1-M2 — REDUCE MOTION IS HONOURED (audit P2).
 *
 * iOS Reduce Motion, Android Remove animations and prefers-reduced-motion were
 * never read. M1 pins the shared store (one platform subscription, live
 * changes); M2 that every moving animation in the app asks it.
 */

function fakeSource(initial: boolean) {
  const handlers: ((v: boolean) => void)[] = [];
  let queried = 0;
  const source: MotionSource = {
    isReduceMotionEnabled: () => { queried += 1; return Promise.resolve(initial); },
    addEventListener: (_e, h) => { handlers.push(h); return { remove() {} }; },
  };
  return { source, handlers, queried: () => queried };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('M1 one store for the app', () => {
  it('starts from the synchronous guess, then the platform answer', async () => {
    const f = fakeSource(true);
    const store = createReducedMotionStore(f.source, false);
    expect(store.getSnapshot()).toBe(false);
    let calls = 0;
    store.subscribe(() => { calls += 1; });
    await tick();
    expect(store.getSnapshot()).toBe(true);
    expect(calls).toBe(1);
  });

  it('follows a change made while the app is open', async () => {
    const f = fakeSource(false);
    const store = createReducedMotionStore(f.source);
    store.subscribe(() => {});
    await tick();
    f.handlers.forEach((h) => h(true));
    expect(store.getSnapshot()).toBe(true);
    f.handlers.forEach((h) => h(false));
    expect(store.getSnapshot()).toBe(false);
  });

  it('asks the platform once, however many components subscribe', () => {
    const f = fakeSource(false);
    const store = createReducedMotionStore(f.source);
    const offs = Array.from({ length: 50 }, () => store.subscribe(() => {}));
    expect(f.queried()).toBe(1);
    expect(f.handlers).toHaveLength(1);
    offs.forEach((off) => off());
  });

  it('a platform that rejects leaves motion on (no crash)', async () => {
    const store = createReducedMotionStore({
      isReduceMotionEnabled: () => Promise.reject(new Error('unsupported')),
      addEventListener: () => undefined,
    });
    store.subscribe(() => {});
    await tick();
    expect(store.getSnapshot()).toBe(false);
  });
});

describe('M2 every moving animation asks', () => {
  const src = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');
  const files = [
    'components/ui/FadeIn.tsx',
    'components/ui/CartToast.tsx',
    'components/ui/Skeleton.tsx',
    'components/order/StatusTimeline.tsx',
    'app/(tabs)/pay.tsx',
    'app/order/confirm.tsx',
    'app/_layout.tsx',
  ];
  for (const f of files) {
    it(f, () => {
      expect(src(f)).toMatch(/useReducedMotion\(\)/);
    });
  }

  it('the root stack keeps the platform push, and crossfades under Reduce Motion', () => {
    expect(src('app/_layout.tsx')).toMatch(/animation: reducedMotion \? 'fade' : 'default'/);
  });
});
