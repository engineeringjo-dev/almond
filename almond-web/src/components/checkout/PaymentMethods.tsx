'use client';

import { useLocale } from 'next-intl';
import { Banknote, Check, CreditCard, Smartphone, Wallet } from 'lucide-react';
import type { PaymentMethodId } from '@almond/shared/types';
import { paymentMethods } from '@almond/shared/menu';
import { useCartStore } from '@/store/cartStore';
import { asLang } from '@/lib/format';
import { cn } from '@/lib/cn';

const ICONS: Record<PaymentMethodId, typeof Wallet> = {
  wallet: Wallet,
  cliq: Smartphone,
  cash: Banknote,
  visa: CreditCard,
  mastercard: CreditCard,
  paypal: CreditCard,
};

export function PaymentMethods() {
  const lang = asLang(useLocale());
  const method = useCartStore((s) => s.paymentMethod);
  const setMethod = useCartStore((s) => s.setPaymentMethod);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {paymentMethods.map((p) => {
        const Icon = ICONS[p.id];
        const selected = p.id === method;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => setMethod(p.id)}
            className={cn(
              'flex items-center justify-between rounded-lg border px-4 py-3 transition-colors',
              selected ? 'border-primary bg-accent-light' : 'border-neutral-warm hover:border-primary',
            )}
          >
            <span className="flex items-center gap-2">
              <Icon className="h-5 w-5 shrink-0 text-primary" />
              <span className="font-bold">{lang === 'ar' ? p.nameAr : p.nameEn}</span>
            </span>
            {selected && <Check className="h-5 w-5 shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}
