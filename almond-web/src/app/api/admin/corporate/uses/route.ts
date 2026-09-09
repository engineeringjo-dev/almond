import { NextResponse } from 'next/server';
import { bff, isAdmin, AdminError } from '@/server/admin';

export const runtime = 'nodejs';

/** Who used a standing discount, how often, and what they took. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const q = new URL(req.url).searchParams.toString();
  try {
    return NextResponse.json(await bff(`/v1/admin/corporate/uses${q ? `?${q}` : ''}`));
  } catch (e) {
    const err = e as AdminError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
  }
}
