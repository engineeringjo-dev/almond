import { NextResponse } from 'next/server';
import { bff, isAdmin, AdminError } from '@/server/admin';

export const runtime = 'nodejs';

/**
 * The corporate register. The browser reaches THIS; this reaches the BFF with
 * the admin key. The key never crosses the network to a browser.
 */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await bff('/v1/admin/companies'));
  } catch (e) {
    const err = e as AdminError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
  }
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    return NextResponse.json(await bff('/v1/admin/companies', { method: 'PUT', body }));
  } catch (e) {
    const err = e as AdminError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
  }
}
