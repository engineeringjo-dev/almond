'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { fieldClass, labelClass } from '@/components/forms/styles';

export function LoginView() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const pendingPhone = useAuthStore((s) => s.pendingPhone);
  const sendOtp = useAuthStore((s) => s.sendOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const logout = useAuthStore((s) => s.logout);

  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<'phone' | 'code' | null>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && user) router.push('/account');
  }, [mounted, user, router]);

  if (!mounted) return <div className="container-content min-h-[50vh] py-xl" />;

  const submitPhone = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '').replace(/^962/, '').replace(/^0/, '');
    if (digits.length < 9) {
      setErr('phone');
      return;
    }
    sendOtp(`+962${digits}`);
    setErr(null);
  };

  const submitOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyOtp(code)) router.push('/account');
    else setErr('code');
  };

  return (
    <div className="container-content py-xxl">
      <div className="mx-auto max-w-sm rounded-lg border border-neutral-warm bg-card p-6 shadow-card">
        <h1 className="text-xl">{t('loginTitle')}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t('subtitle')}</p>

        {!pendingPhone ? (
          <form onSubmit={submitPhone} className="mt-5 space-y-3">
            <div>
              <label className={labelClass}>{t('phoneLabel')}</label>
              <div className="flex items-center gap-2">
                <span
                  dir="ltr"
                  className="inline-flex h-11 items-center rounded-md border border-neutral-warm px-3 text-sm font-bold"
                >
                  +962
                </span>
                <input
                  dir="ltr"
                  type="tel"
                  className={fieldClass}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setErr(null);
                  }}
                  placeholder="7XXXXXXXX"
                />
              </div>
            </div>
            {err === 'phone' && <p className="text-sm text-error">{t('invalidPhone')}</p>}
            <Button type="submit" className="w-full">
              {t('sendCode')}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="mt-5 space-y-3">
            <p className="text-sm text-text-secondary">{t('otpSentTo', { phone: pendingPhone })}</p>
            <div>
              <label className={labelClass}>{t('otpTitle')}</label>
              <input
                dir="ltr"
                inputMode="numeric"
                maxLength={4}
                className={`${fieldClass} text-center text-lg tracking-[0.5em]`}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setErr(null);
                }}
                placeholder="0000"
              />
            </div>
            {err === 'code' && <p className="text-sm text-error">{t('invalidCode')}</p>}
            <p className="text-xs text-text-secondary">{t('demoHint')}</p>
            <Button type="submit" className="w-full">
              {t('verify')}
            </Button>
            <button
              type="button"
              onClick={() => {
                logout();
                setCode('');
              }}
              className="w-full text-sm font-bold text-text-secondary hover:text-primary"
            >
              {t('changeNumber')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
