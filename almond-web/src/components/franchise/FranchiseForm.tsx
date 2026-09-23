'use client';

import { useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import {
  ALLOWED_COUNTRIES,
  INVESTMENT_RANGES,
  submitFranchiseApplication,
} from '@/data/applications';
import { asLang } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { fieldClass, labelClass } from '@/components/forms/styles';

export function FranchiseForm() {
  const t = useTranslations('Franchise');
  // Ties every <label> to its control: a sibling label with no htmlFor
  // names nothing, so each field was announced as an unlabeled edit box.
  const uid = useId();
  const lang = asLang(useLocale());

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    investment: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.country || !form.city || !form.investment) {
      setStatus('error');
      return;
    }
    setStatus('submitting');
    await submitFranchiseApplication(form);
    setStatus('done');
  };

  if (status === 'done') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-neutral-warm bg-card p-8 text-center shadow-card">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <p className="text-lg font-bold">{t('success')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-neutral-warm bg-card p-6 shadow-card">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`${uid}-1`}>{t('name')}</label>
          <input id={`${uid}-1`} className={fieldClass} value={form.name} onChange={set('name')} required />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${uid}-2`}>{t('phone')}</label>
          <input id={`${uid}-2`} type="tel" dir="ltr" className={fieldClass} value={form.phone} onChange={set('phone')} required />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${uid}-3`}>{t('email')}</label>
          <input id={`${uid}-3`} type="email" dir="ltr" className={fieldClass} value={form.email} onChange={set('email')} required />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${uid}-4`}>{t('country')}</label>
          <select id={`${uid}-4`} className={fieldClass} value={form.country} onChange={set('country')} required>
            <option value="" disabled>
              {t('selectCountry')}
            </option>
            {ALLOWED_COUNTRIES.map((c) => (
              <option key={c.id} value={c.id}>
                {lang === 'ar' ? c.ar : c.en}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor={`${uid}-5`}>{t('city')}</label>
          <input id={`${uid}-5`} className={fieldClass} value={form.city} onChange={set('city')} required />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${uid}-6`}>{t('investment')}</label>
          <select id={`${uid}-6`} className={fieldClass} value={form.investment} onChange={set('investment')} required>
            <option value="" disabled>
              {t('selectInvestment')}
            </option>
            {INVESTMENT_RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {lang === 'ar' ? r.ar : r.en}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor={`${uid}-7`}>{t('message')}</label>
        <textarea id={`${uid}-7`}
          rows={4}
          className={`${fieldClass} h-auto py-2`}
          value={form.message}
          onChange={set('message')}
        />
      </div>
      {status === 'error' && (
        <p role="alert" className="text-sm text-error">
          {t('required')}
        </p>
      )}
      <Button type="submit" disabled={status === 'submitting'} className="w-full">
        {status === 'submitting' ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
