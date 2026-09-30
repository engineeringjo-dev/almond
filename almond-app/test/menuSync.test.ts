import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The app's menu updates from the server like Careem/Talabat (GM, 2026-09-30),
 * and never ends up worse than the menu it already has.
 */
const disk = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => disk.get(k) ?? null,
    setItem: async (k: string, v: string) => { disk.set(k, v); },
    removeItem: async (k: string) => { disk.delete(k); },
  },
}));

const { buildAppMenuPayload, APP_MENU_SCHEMA } = await import('@almond/shared/menu/remote');
const { categories, menuItems } = await import('@almond/shared/menu/seed');
const { menuPulledAt } = await import('@almond/shared/menu/menu.generated');
const { getMenu, resetMenuForTests } = await import('@almond/shared/menu/store');
const { refreshMenu, hydrateMenuFromCache, MENU_CACHE_KEY } = await import('@/services/menuSync');
const { menuService } = await import('@/services/menu.service');

// "Tomorrow's" menu: everything today has, plus a new autumn drink.
const NEW_ITEM = { ...structuredClone(menuItems[0]!), id: 'p-999001', nameEn: 'Maple Latte', nameAr: 'لاتيه القيقب' };
const payload = (over: Record<string, unknown> = {}) => ({
  ...buildAppMenuPayload({ categories, items: [...menuItems, NEW_ITEM], updatedAt: menuPulledAt, assetBase: 'https://menu.example' }),
  ...over,
});
const serve = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

beforeEach(() => { disk.clear(); resetMenuForTests(); });

describe('menu sync', () => {
  it('a new item on the server reaches every screen and the cache — no app release', async () => {
    expect(await refreshMenu(serve(payload()))).toBe('updated');
    expect((await menuService.getItems('all')).some((i) => i.id === 'p-999001')).toBe(true);
    expect((await menuService.getItem('p-999001')).nameAr).toBe('لاتيه القيقب');
    expect(getMenu().source).toBe('server');
    expect(disk.has(MENU_CACHE_KEY)).toBe(true);
  });

  it('the next launch opens on the cached server menu, even offline', async () => {
    await refreshMenu(serve(payload()));
    resetMenuForTests();                                  // app restarts: bundled again
    expect(await hydrateMenuFromCache()).toBe(true);
    expect(getMenu().source).toBe('cache');
    expect(await refreshMenu((async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBe('offline');
    expect((await menuService.getItems('all')).some((i) => i.id === 'p-999001')).toBe(true);
  });

  it('the same menu twice is not re-applied', async () => {
    expect(await refreshMenu(serve(payload()))).toBe('updated');
    expect(await refreshMenu(serve(payload()))).toBe('unchanged');
  });

  it('a bad menu is refused whole — the app keeps what it has', async () => {
    const p = payload();
    const broken = { ...p, items: p.items.map((i, n) => (n === 5 ? { ...i, sizes: [{ ...i.sizes[0]!, price: 0 }] } : i)) };
    expect(await refreshMenu(serve(broken))).toBe('invalid');
    expect(getMenu().source).toBe('bundled');
    expect(disk.has(MENU_CACHE_KEY)).toBe(false);
  });

  it('a new menu SHAPE waits for the app update', async () => {
    expect(await refreshMenu(serve(payload({ schema: APP_MENU_SCHEMA + 1 })))).toBe('needs_app_update');
    expect(getMenu().source).toBe('bundled');
  });

  it('never goes backwards to a menu older than the one bundled in this build', async () => {
    expect(await refreshMenu(serve(payload({ updatedAt: '2020-01-01' })))).toBe('unchanged');
    disk.set(MENU_CACHE_KEY, JSON.stringify(payload({ updatedAt: '2020-01-01' })));
    expect(await hydrateMenuFromCache()).toBe(false);
    expect(getMenu().source).toBe('bundled');
  });

  it('asks "changed?" with the version it holds; a 304 costs no download and no parse', async () => {
    const seen: (string | undefined)[] = [];
    let jsonCalls = 0;
    const server = (status: number, body: unknown) => (async (_u: string, init?: RequestInit) => {
      seen.push((init?.headers as Record<string, string>)['if-none-match']);
      return { ok: status === 200, status, json: async () => { jsonCalls++; return body; } };
    }) as unknown as typeof fetch;
    const p = payload();
    expect(await refreshMenu(server(200, p))).toBe('updated');        // first launch: nothing to compare
    expect(seen[0]).toBeUndefined();
    jsonCalls = 0;
    expect(await refreshMenu(server(304, null))).toBe('unchanged');   // next check: unchanged
    expect(seen[1]).toBe(`"${p.version}"`);
    expect(jsonCalls).toBe(0);
    expect(getMenu().version).toBe(p.version);
  });

  it('a server error keeps the menu', async () => {
    expect(await refreshMenu(serve({}, false))).toBe('offline');
    expect(getMenu().source).toBe('bundled');
  });
});
