import { NextResponse } from 'next/server';
import { bff, isAdmin, AdminError } from '@/server/admin';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await bff(`/v1/admin/companies/${encodeURIComponent(id)}/roster`));
  } catch (e) {
    const err = e as AdminError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
  }
}

/** REPLACES the roster. The reply carries `before`, `after` and every rejected
 *  line, and the screen shows all three — an upload that silently stores 180 of
 *  200 rows is how a company arrives at the till expecting a discount. */
export async function PUT(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    return NextResponse.json(
      await bff(`/v1/admin/companies/${encodeURIComponent(id)}/roster`, { method: 'PUT', body }),
    );
  } catch (e) {
    const err = e as AdminError;
    return NextResponse.json({ error: err.message }, { status: err.status ?? 502 });
  }
}
