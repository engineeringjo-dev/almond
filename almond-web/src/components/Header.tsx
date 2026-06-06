'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Menu, ShoppingBag, User, X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useCartCount } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/menu', key: 'menu' },
  { href: '/rewards', key: 'rewards' },
  { href: '/branches', key: 'branches' },
  { href: '/gifts', key: 'gifts' },
] as const;

export function Header() {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Cart count — only after mount, to avoid an SSR/localStorage hydration mismatch.
  const count = useCartCount();
  const user = useAuthStore((s) => s.user);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-warm bg-white/90 backdrop-blur">
      <div className="container-content flex h-16 items-center justify-between gap-4">
        {/* Brand + desktop nav */}
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Almond" onClick={() => setOpen(false)}>
            <Logo className="h-9" priority />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'text-sm font-bold transition-colors duration-base hover:text-primary',
                  isActive(item.href) ? 'text-primary' : 'text-text-primary',
                )}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <Link
            href={mounted && user ? '/account' : '/login'}
            aria-label={mounted && user ? t('account') : t('login')}
            className="hidden h-10 w-10 items-center justify-center rounded-pill text-text-primary hover:bg-neutral-warm sm:inline-flex"
          >
            <User className="h-5 w-5" />
          </Link>
          <Link
            href="/cart"
            aria-label={t('cart')}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-pill text-text-primary hover:bg-neutral-warm"
          >
            <ShoppingBag className="h-5 w-5" />
            {mounted && count > 0 && (
              <span className="absolute -end-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-primary px-1 text-xs font-bold text-white">
                {count}
              </span>
            )}
          </Link>
          <Button href="/menu" size="md" className="hidden sm:inline-flex">
            {t('orderNow')}
          </Button>
          <button
            type="button"
            aria-label={open ? t('closeMenu') : t('openMenu')}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-pill text-text-primary hover:bg-neutral-warm md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <div className="border-t border-neutral-warm bg-white md:hidden">
          <nav className="container-content flex flex-col py-3">
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-md px-2 py-3 text-md font-bold hover:bg-neutral-warm',
                  isActive(item.href) ? 'text-primary' : 'text-text-primary',
                )}
              >
                {t(item.key)}
              </Link>
            ))}
            <div className="mt-3 flex items-center justify-between gap-3">
              <LanguageSwitcher />
              <Button href="/menu" size="md" className="flex-1" >
                {t('orderNow')}
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
