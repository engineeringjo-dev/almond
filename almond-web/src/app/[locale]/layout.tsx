import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import localFont from 'next/font/local';

import { routing, type AppLocale } from '@/i18n/routing';
import { themeVars } from '@/theme/cssVars';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Providers } from '../providers';
import '../globals.css';

// Single bilingual family — Helvetica Neue LT Arabic (Light/Roman/Bold).
const hnArabic = localFont({
  src: [
    { path: '../fonts/HelveticaNeueArabic-Light.ttf', weight: '300', style: 'normal' },
    { path: '../fonts/HelveticaNeueArabic-Roman.ttf', weight: '400', style: 'normal' },
    { path: '../fonts/HelveticaNeueArabic-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-hn-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Almond Coffee House',
    template: '%s · Almond Coffee House',
  },
  description:
    'Order Almond Coffee House — the real menu, pickup or delivery, and the same points rewards + wallet as the app. Bilingual Arabic / English.',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as AppLocale)) {
    notFound();
  }

  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html
      lang={locale}
      dir={dir}
      className={hnArabic.variable}
      style={themeVars}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
