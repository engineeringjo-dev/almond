import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { voucherAvailabilityKey, voucherHandoff } from '@/lib/redeemSheet';
import type { Voucher } from '@/types';

const voucher = (id: string): Voucher => ({
  id, titleAr: 'قسيمة', titleEn: 'Voucher', type: 'credit', value: 1,
  expiresAt: '2026-11-15T12:00:00Z',
});

describe('VH1 the success handoff identifies the voucher actually returned', () => {
  it('selects by id even when another voucher is first, without changing the list', () => {
    const older = voucher('older');
    const issued = voucher('issued');
    const another = voucher('another');
    const input = Object.freeze([older, issued, another]);
    const handoff = voucherHandoff(input, issued.id);
    expect(handoff.selected).toBe(issued);
    expect(handoff.others).toEqual([older, another]);
    expect(input).toEqual([older, issued, another]);
  });

  it('does not present a different voucher as the newly issued one when the id is missing', () => {
    const input = [voucher('older')];
    expect(voucherHandoff(input, 'missing')).toEqual({ selected: null, others: input });
    expect(voucherHandoff(input)).toEqual({ selected: null, others: input });
    expect(voucherHandoff([], 'issued')).toEqual({ selected: null, others: [] });
  });
});

describe('VH2 a preview voucher is not a POS redemption credential', () => {
  it('labels availability from the same source switch as the service', () => {
    expect(voucherAvailabilityKey('mock')).toBe('loyalty.voucherDemo');
    expect(voucherAvailabilityKey('odoo')).toBe('loyalty.voucherNotReady');
  });

  it('does not turn a Voucher id or a member code into a spend code', () => {
    const card = readFileSync(join(__dirname, '../components/loyalty/VoucherCard.tsx'), 'utf8');
    expect(card).not.toMatch(/QRCode|formatRedemptionCode|voucher\.id|getPosToken/);
    expect(card).toContain('voucherAvailabilityKey(config.DATA_SOURCE)');
    expect(card).toContain('formatDate(voucher.expiresAt, lang)');
  });
});
