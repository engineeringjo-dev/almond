'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { fieldClass, labelClass } from '@/components/forms/styles';

/**
 * The login. It posts to /api/admin/session, which sets an httpOnly cookie —
 * this component never learns the password's value, holds no session state, and
 * has nothing a browser console could flip.
 */
export function AdminLogin({ configured }: { configured: boolean }) {
  const t = useTranslations('Admin');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<'' | 'wrong' | 'throttled'>('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="container-content py-xxl">
      <div className="mx-auto max-w-sm rounded-lg border border-neutral-warm bg-card p-6 shadow-card">
        <h1 className="text-xl font-bold">{t('loginTitle')}</h1>

        {!configured ? (
          // Says what is missing rather than refusing a correct password in
          // silence — an operator otherwise retypes it against a server that
          // could never have accepted it.
          <p role="alert" className="mt-4 rounded-md border border-error bg-[color:color-mix(in_srgb,var(--color-error)_10%,transparent)] p-3 text-sm">
            {t('notConfigured')}
          </p>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true); setErr('');
              const r = await fetch('/api/admin/session', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ password: pass }),
              });
              setBusy(false);
              if (r.ok) window.location.reload();
              // A throttled login (429) is not a wrong password — saying so
              // would send the administrator retyping a correct one.
              else setErr(r.status === 429 ? 'throttled' : 'wrong');
            }}
          >
            <div>
              <label className={labelClass} htmlFor="admin-pass">{t('password')}</label>
              <input
                id="admin-pass"
                type="password"
                autoComplete="current-password"
                className={fieldClass}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                aria-invalid={err ? true : undefined}
                aria-describedby={err ? 'admin-pass-error' : undefined}
              />
            </div>
            {err ? (
              <p id="admin-pass-error" role="alert" className="text-sm text-error">
                {err === 'throttled' ? t('tooManyAttempts') : t('wrongPass')}
              </p>
            ) : null}
            <Button type="submit" disabled={busy} className="w-full">{t('login')}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
