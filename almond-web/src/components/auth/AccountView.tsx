'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';

const LINKS = [
  { href: '/rewards', key: 'rewards' },
  { href: '/wallet', key: 'wallet' },
  { href: '/gifts', key: 'gifts' },
] as const;

export function AccountView() {
  const t = useTranslations('Account');
  const nav = useTranslations('Nav');
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <PageSkeleton />;

  if (!user) {
    return (
      <section className="container-content flex min-h-[50vh] flex-col items-center justify-center gap-4 py-xxl text-center">
        <h1 className="text-xxl">{t('title')}</h1>
        <p className="text-md text-text-secondary">{t('guest')}</p>
        <Button href="/login" size="lg">
          {t('loginCta')}
        </Button>
      </section>
    );
  }

  return (
    <div className="container-content py-xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xxl">{t('title')}</h1>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-1 text-sm font-bold text-text-secondary hover:text-error"
        >
          <LogOut className="h-4 w-4" />
          {t('logout')}
        </button>
      </div>

      <div className="mt-6 flex items-center gap-4 rounded-lg border border-neutral-warm bg-card p-5 shadow-card">
        <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-neutral-warm text-primary">
          <User className="h-6 w-6" />
        </span>
        <div>
          <p className="font-bold">{user.name ?? user.phone}</p>
          <p className="text-sm text-text-secondary" dir="ltr">
            {user.phone}
          </p>
        </div>
      </div>

      <h2 className="mt-8 text-lg">{t('quickLinks')}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {LINKS.map((l) => (
          <Link
            key={l.key}
            href={l.href}
            className="rounded-lg border border-neutral-warm bg-card p-4 font-bold shadow-card transition-colors hover:border-primary"
          >
            {nav(l.key)}
          </Link>
        ))}
      </div>
    </div>
  );
}
