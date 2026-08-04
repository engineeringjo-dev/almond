import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/server/ishbek';
import type { DeliveryStatusEvent } from '@/lib/delivery-types';

export const runtime = 'nodejs';

/**
 * Inbound Ishbek status webhook (Ishbek → Almond). Steps:
 *  1. verify the HMAC signature (reject anything unsigned/mismatched),
 *  2. reject any timestamp without an explicit offset — an offset-less `Z`
 *     stamp is exactly what broke POS reflection,
 *  3. forward the status to Odoo (TODO at live wiring) so the order updates.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get('x-ishbek-signature');

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event: DeliveryStatusEvent;
  try {
    event = JSON.parse(raw) as DeliveryStatusEvent;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // Guard the timezone contract: occurredAt must carry an explicit offset.
  if (!/[+-]\d{2}:\d{2}$/.test(event.occurredAt ?? '')) {
    return NextResponse.json(
      { error: 'occurredAt must include an explicit +03:00 offset' },
      { status: 422 },
    );
  }

  // TODO(live): map event.status → order status in Odoo (order = event.orderId).
  return NextResponse.json({ ok: true });
}
