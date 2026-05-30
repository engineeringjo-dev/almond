import type { PaymentMethodId } from '@/types';
import { config } from '@/constants/config';
import { delay, genId } from './util';

export interface PaymentResult {
  success: boolean;
  transactionId: string;
}

export interface PaymentService {
  /** Process a payment. Real processing is out of MVP scope (section 0.3). */
  pay(amount: number, method: PaymentMethodId): Promise<PaymentResult>;
}

const mockPaymentService: PaymentService = {
  // Mock always succeeds (section 0.3 — build UI + mock paymentService).
  pay: (_amount, _method) => delay({ success: true, transactionId: genId('txn') }, 600),
};

const odooPaymentService: PaymentService = {
  // TODO: integrate real gateway (CliQ/Visa/Mastercard/PayPal) when available.
  pay: mockPaymentService.pay,
};

export const paymentService: PaymentService =
  config.DATA_SOURCE === 'odoo' ? odooPaymentService : mockPaymentService;
