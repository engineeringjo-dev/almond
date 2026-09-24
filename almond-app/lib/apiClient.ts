/**
 * Tiny authed fetch wrapper shared by the live (Odoo / loyalty-server) clients.
 * Adds base URL + auth headers + JSON + a timeout. Inactive under mock.
 */

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * A refusal the server NAMED. The BFF answers every refusal as
 * `{ error: <machine code>, message }` (bff/src/server.ts), and a screen needs
 * the code — `insufficient_points` and `transfer_daily_cap` are different
 * sentences to a member — so it is kept rather than folded into a status line.
 * The mock throws the same class with the same codes, so a screen is written
 * once for both.
 */
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message?: string) {
    super(message ?? `${status} ${code}`);
    this.name = 'ApiError';
  }
}

/** The machine code behind a failure, or null when it was not a named refusal. */
export const apiErrorCode = (e: unknown): string | null => (e instanceof ApiError ? e.code : null);

/**
 * A fresh Idempotency-Key. One per member INTENT (a screen makes one when the
 * member confirms and reuses it for every retry of that confirmation), never
 * one per HTTP attempt — a key per attempt is no key at all.
 */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

async function request<T>(
  method: 'GET' | 'POST',
  base: string,
  path: string,
  opts: { body?: unknown; headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(opts.headers ?? {}),
      },
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      let code = 'http_error';
      try {
        const body = (await res.json()) as { error?: unknown };
        if (typeof body?.error === 'string') code = body.error;
      } catch { /* not JSON: the status is all there is */ }
      throw new ApiError(res.status, code, `API ${method} ${path} failed: ${res.status} ${code}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function apiGet<T>(base: string, path: string, headers?: Record<string, string>): Promise<T> {
  return request<T>('GET', base, path, { headers });
}

export function apiPost<T>(
  base: string,
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  return request<T>('POST', base, path, { body, headers });
}
