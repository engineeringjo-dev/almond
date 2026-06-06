'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Apple, Play, X } from 'lucide-react';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/links';
import { Logo } from '@/components/ui/Logo';

const KEY = 'almond-app-banner-dismissed';

/** Dismissible "get the app" smart banner (persisted dismissal). */
export function AppDownloadBanner() {
  const t = useTranslations('App');
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== '1') setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const store =
    'inline-flex h-9 items-center gap-1.5 rounded-pill bg-primary px-3 text-xs font-bold text-white hover:bg-primary-dark';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-warm bg-white/95 backdrop-blur">
      <div className="container-content flex items-center gap-3 py-3">
        <Logo kind="badge" className="h-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{t('title')}</p>
          <p className="hidden truncate text-xs text-text-secondary sm:block">{t('subtitle')}</p>
        </div>
        <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={store}>
          <Apple className="h-4 w-4" />
          <span className="hidden sm:inline">{t('appStore')}</span>
        </a>
        <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className={store}>
          <Play className="h-4 w-4" />
          <span className="hidden sm:inline">{t('googlePlay')}</span>
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-text-secondary hover:bg-neutral-warm"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
