'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminAuth } from '@/store/adminAuth';
import { Button } from '@/components/ui/Button';
import { fieldClass, labelClass } from '@/components/forms/styles';

/** Mock admin login gate. Swap for the real auth seam (OTP/SSO) later. */
export function AdminGate({ children }: { children: ReactNode }) {
  const t = useTranslations('Admin');
  const authed = useAdminAuth((s) => s.authed);
  const login = useAdminAuth((s) => s.login);

  const [mounted, setMounted] = useState(false);
  const [pass, setPass] = useState('');
  const [err, setErr] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="container-content min-h-[50vh] py-xl" />;

  if (!authed) {
    return (
      <div className="container-content py-xxl">
        <div className="mx-auto max-w-sm rounded-lg border border-neutral-warm bg-card p-6 shadow-card">
          <h1 className="text-xl">{t('loginTitle')}</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!login(pass)) setErr(true);
            }}
            className="mt-4 space-y-3"
          >
            <div>
              <label className={labelClass}>{t('password')}</label>
              <input
                type="password"
                className={fieldClass}
                value={pass}
                onChange={(e) => {
                  setPass(e.target.value);
                  setErr(false);
                }}
              />
            </div>
            {err && <p className="text-sm text-error">{t('wrongPass')}</p>}
            <Button type="submit" className="w-full">
              {t('login')}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
