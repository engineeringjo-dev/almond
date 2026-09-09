import { NextResponse } from 'next/server';
import { adminConfigured, signInAdmin, signOutAdmin, isAdmin } from '@/server/admin';

export const runtime = 'nodejs';

/** Is there a live session, and is the back-office configured at all? */
export async function GET() {
  return NextResponse.json({ authed: await isAdmin(), configured: adminConfigured() });
}

export async function POST(req: Request) {
  const { password } = (await req.json()) as { password?: string };
  if (!adminConfigured()) {
    // Says WHICH setting is missing, because the alternative is an
    // administrator retyping a correct password against a server that could
    // never have accepted it.
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD and ADMIN_KEY must be set on the server' },
      { status: 503 },
    );
  }
  if (!(await signInAdmin(password ?? ''))) {
    return NextResponse.json({ error: 'wrong password' }, { status: 401 });
  }
  return NextResponse.json({ authed: true });
}

export async function DELETE() {
  await signOutAdmin();
  return NextResponse.json({ authed: false });
}
