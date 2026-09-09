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
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="container-content py-xxl">
      <div className="mx-auto max-w-sm rounded-lg border border-neutral-warm bg-card p-6 shadow-card">
        <h1 className="text-xl font-bold">{t('loginTitle')}</h1>

        {!configured ? (
          // Says what is missing rather than refusing a correct password in
          // silence — an operator otherwise retypes it against a server that
          // could never have accepted it.
          <p className="mt-4 rounded-md border border-error bg-error/10 p-3 text-sm">
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
              else setErr(((await r.json()) as { error?: string }).error ?? t('wrongPass'));
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
              />
            </div>
            {err ? <p className="text-sm text-error">{t('wrongPass')}</p> : null}
            <Button type="submit" disabled={busy} className="w-full">{t('login')}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
