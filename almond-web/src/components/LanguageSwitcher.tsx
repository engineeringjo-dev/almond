'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import type { AppLocale } from '@/i18n/routing';

/** AR / EN toggle that keeps the current path and flips locale (and direction). */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const switchTo = (next: AppLocale) => {
    if (next !== locale) router.replace(pathname, { locale: next });
  };

  const segment = (value: AppLocale, label: string) => (
    <button
      type="button"
      onClick={() => switchTo(value)}
      aria-pressed={locale === value}
      className={cn(
        'rounded-pill px-3 py-1 text-sm font-bold transition-colors duration-base',
        locale === value ? 'bg-primary text-white' : 'text-text-secondary hover:text-primary',
      )}
    >
      {label}
    </button>
  );

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border border-neutral-warm bg-white p-1',
        className,
      )}
    >
      {segment('ar', 'عربي')}
      {segment('en', 'EN')}
    </div>
  );
}
