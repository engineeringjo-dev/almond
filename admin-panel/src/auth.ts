import { config } from './config';

/**
 * Mock admin auth (section 13.5). All /admin endpoints require JWT with admin
 * role (section 13.3); here we mint a fake token. Flip DATA_SOURCE to 'live'
 * to call a real admin login endpoint.
 */
const TOKEN_KEY = 'almond.admin.token';

export async function login(username: string, password: string): Promise<boolean> {
  if (!username.trim() || !password.trim()) return false;
  if (config.DATA_SOURCE === 'live') {
    const res = await fetch(`${config.LOYALTY_BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return false;
    const { token } = (await res.json()) as { token: string };
    localStorage.setItem(TOKEN_KEY, token);
    return true;
  }
  // Mock: accept any credentials, mint a fake admin token.
  localStorage.setItem(TOKEN_KEY, `mock.admin.${btoa(username)}`);
  return true;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthed(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}
