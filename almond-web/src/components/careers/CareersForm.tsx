'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { POSITIONS, submitJobApplication } from '@/data/applications';
import { asLang } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { fieldClass, labelClass } from '@/components/forms/styles';

export function CareersForm() {
  const t = useTranslations('Careers');
  const lang = asLang(useLocale());

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    cv: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.position) {
      setStatus('error');
      return;
    }
    setStatus('submitting');
    await submitJobApplication(form);
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
          <label className={labelClass}>{t('name')}</label>
          <input className={fieldClass} value={form.name} onChange={set('name')} required />
        </div>
        <div>
          <label className={labelClass}>{t('phone')}</label>
          <input type="tel" dir="ltr" className={fieldClass} value={form.phone} onChange={set('phone')} required />
        </div>
        <div>
          <label className={labelClass}>{t('email')}</label>
          <input type="email" dir="ltr" className={fieldClass} value={form.email} onChange={set('email')} required />
        </div>
        <div>
          <label className={labelClass}>{t('position')}</label>
          <select className={fieldClass} value={form.position} onChange={set('position')} required>
            <option value="" disabled>
              {t('selectPosition')}
            </option>
            {POSITIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {lang === 'ar' ? p.ar : p.en}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t('cv')}</label>
        <input type="url" dir="ltr" className={fieldClass} value={form.cv} onChange={set('cv')} placeholder="https://" />
      </div>
      <div>
        <label className={labelClass}>{t('message')}</label>
        <textarea
          rows={4}
          className={`${fieldClass} h-auto py-2`}
          value={form.message}
          onChange={set('message')}
        />
      </div>
      {status === 'error' && <p className="text-sm text-error">{t('required')}</p>}
      <Button type="submit" disabled={status === 'submitting'} className="w-full">
        {status === 'submitting' ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
