/**
 * Tiny authed fetch wrapper shared by the live (Odoo / loyalty-server) clients.
 * Adds base URL + auth headers + JSON + a timeout. Inactive under mock.
 */

const DEFAULT_TIMEOUT_MS = 15000;

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
      throw new Error(`API ${method} ${path} failed: ${res.status}`);
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
