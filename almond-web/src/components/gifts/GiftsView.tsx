'use client';

import Image from 'next/image';
import { useEffect, useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Copy } from 'lucide-react';
import type { GiftCard, GiftOccasion } from '@almond/shared/types';
import {
  FEATURED_GIFT_DESIGN_ID,
  GIFT_OCCASIONS,
  giftDesignById,
  giftDesignsFor,
  type GiftDesign,
} from '@almond/shared/gifts';
import { useLoyaltyStore } from '@/store/loyaltyStore';
import { GIFT_AMOUNTS } from '@/data/loyalty';
import { asLang, formatJOD } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export function GiftsView() {
  const t = useTranslations('Gifts');
  // Ties every <label> to its control: a sibling label with no htmlFor
  // names nothing, so each field was announced as an unlabeled edit box.
  const uid = useId();
  const lang = asLang(useLocale());
  const sendGift = useLoyaltyStore((s) => s.sendGift);
  const redeemGift = useLoyaltyStore((s) => s.redeemGift);
  const giftsSent = useLoyaltyStore((s) => s.giftsSent);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [tab, setTab] = useState<'send' | 'redeem'>('send');
  const [occasion, setOccasion] = useState<GiftOccasion>(giftDesignById(FEATURED_GIFT_DESIGN_ID).occasion);
  const [designId, setDesignId] = useState(FEATURED_GIFT_DESIGN_ID);
  const [amount, setAmount] = useState(GIFT_AMOUNTS[1]);
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [created, setCreated] = useState<GiftCard | null>(null);
  const [copied, setCopied] = useState(false);

  const [code, setCode] = useState('');
  const [redeemStatus, setRedeemStatus] = useState<'idle' | 'ok' | 'bad'>('idle');

  if (!mounted) return <div className="container-content min-h-[50vh] py-xl" />;

  const submitGift = () => {
    if (!recipient.trim()) return;
    const card = sendGift({ amount, recipientName: recipient.trim(), message: message.trim() || undefined, designId });
    setCreated(card);
    setRecipient('');
    setMessage('');
  };

  const copyCode = async () => {
    if (!created) return;
    try {
      await navigator.clipboard?.writeText(created.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const submitRedeem = () => setRedeemStatus(redeemGift(code) ? 'ok' : 'bad');

  const design = giftDesignById(designId);
  const designs = giftDesignsFor(occasion, lang);
  // Picking an occasion picks its first card too (in the reader's language),
  // so the preview never shows a card from another occasion.
  const pickOccasion = (id: GiftOccasion) => {
    setOccasion(id);
    setDesignId(giftDesignsFor(id, lang)[0].id);
  };

  return (
    <div className="container-content py-xl">
      <h1 className="text-xxl">{t('title')}</h1>
      <p className="mt-1 text-md text-text-secondary">{t('subtitle')}</p>

      {/* Tabs */}
      <div className="mt-6 inline-flex rounded-pill border border-neutral-warm bg-card p-1">
        {(['send', 'redeem'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'rounded-pill px-5 py-2 text-sm font-bold transition-colors',
              tab === id ? 'bg-primary text-white' : 'text-text-secondary hover:text-primary',
            )}
          >
            {id === 'send' ? t('sendTab') : t('redeemTab')}
          </button>
        ))}
      </div>

      {tab === 'send' ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6 rounded-lg border border-neutral-warm bg-card p-6 shadow-card">
            {/* Occasion */}
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-secondary">
                {t('occasion')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {GIFT_OCCASIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pickOccasion(o.id)}
                    aria-pressed={occasion === o.id}
                    className={cn(
                      'rounded-pill border px-4 py-2 text-sm font-bold transition-colors',
                      occasion === o.id
                        ? 'border-primary bg-primary text-white'
                        : 'border-neutral-warm hover:border-primary',
                    )}
                  >
                    {lang === 'ar' ? o.titleAr : o.titleEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Design — the occasion's cards, the reader's language first */}
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-secondary">
                {t('design')}
              </h2>
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t('design')}>
                {designs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={designId === d.id}
                    onClick={() => setDesignId(d.id)}
                    className={cn(
                      'rounded-lg p-1 outline-offset-2 transition-shadow',
                      designId === d.id ? 'ring-2 ring-primary' : 'ring-1 ring-neutral-warm hover:ring-primary',
                    )}
                  >
                    <GiftArt design={d} sizes="(min-width: 1024px) 240px, 45vw" />
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-secondary">
                {t('amount')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {GIFT_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmount(a)}
                    className={cn(
                      'rounded-pill border px-4 py-2 text-sm font-bold transition-colors',
                      amount === a ? 'border-primary bg-primary text-white' : 'border-neutral-warm hover:border-primary',
                    )}
                  >
                    {formatJOD(a, lang)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold uppercase tracking-wide text-text-secondary" htmlFor={`${uid}-1`}>
                {t('recipient')}
              </label>
              <input id={`${uid}-1`}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={t('recipientPlaceholder')}
                className="h-11 w-full rounded-md border border-neutral-warm bg-background px-4 outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold uppercase tracking-wide text-text-secondary" htmlFor={`${uid}-2`}>
                {t('message')}
              </label>
              <textarea id={`${uid}-2`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('messagePlaceholder')}
                rows={3}
                className="w-full rounded-md border border-neutral-warm bg-background px-4 py-2 outline-none focus:border-primary"
              />
            </div>

            <Button onClick={submitGift} disabled={!recipient.trim()} className="w-full">
              {t('sendCta')}
            </Button>
          </div>

          {/* Preview / created code */}
          <div className="h-fit space-y-4">
            {/* The card exactly as drawn; the personal details travel with it,
                never on it (design brief: "inside the envelope"). */}
            <GiftArt design={design} sizes="(min-width: 1024px) 420px, 100vw" priority />
            <div className="rounded-lg border-2 border-dashed border-neutral-warm bg-card p-4 text-center">
              <p className="text-xxl font-bold text-primary-dark">{formatJOD(amount, lang)}</p>
              {recipient.trim() && <p className="mt-1 font-bold">{t('to', { name: recipient.trim() })}</p>}
              {message.trim() && <p className="mt-1 text-sm text-text-secondary">{lang === 'ar' ? `«${message.trim()}»` : `“${message.trim()}”`}</p>}
            </div>

            {created && (
              <div className="rounded-lg border border-primary bg-accent-light p-4">
                <p className="text-sm text-primary-dark">{t('sent')}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <code className="text-lg font-bold text-primary-dark">{created.code}</code>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="inline-flex items-center gap-1 rounded-pill border border-primary px-3 py-1 text-sm font-bold text-primary-dark"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? t('copied') : t('copy')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 max-w-md space-y-4">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setRedeemStatus('idle');
              }}
              placeholder={t('codePlaceholder')}
              aria-label={t('codePlaceholder')}
              className="h-11 flex-1 rounded-md border border-neutral-warm bg-background px-4 outline-none focus:border-primary"
            />
            <Button onClick={submitRedeem} size="md">
              {t('redeemCta')}
            </Button>
          </div>
          {redeemStatus === 'ok' && (
            <p className="flex items-center gap-2 font-bold text-success">
              <Check className="h-4 w-4" />
              {t('redeemSuccess')}
            </p>
          )}
          {redeemStatus === 'bad' && <p className="font-bold text-error">{t('redeemInvalid')}</p>}
        </div>
      )}

      {/* Sent gifts */}
      {giftsSent.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl">{t('sentTitle')}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {giftsSent.map((g) => (
              <div key={g.id} className="rounded-lg border border-neutral-warm bg-card p-4 shadow-card">
                <GiftArt design={giftDesignById(g.designId)} sizes="(min-width: 1024px) 300px, 90vw" className="mb-3" />
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary">{formatJOD(g.amount, lang)}</span>
                  {g.redeemed && (
                    <span className="rounded-pill bg-neutral-warm px-2 py-0.5 text-xs text-text-secondary">
                      {t('redeemSuccess')}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-text-secondary">{t('to', { name: g.recipientName })}</p>
                <code className="mt-2 block text-sm font-bold">{g.code}</code>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** One card's artwork at the card's own ratio (CR80, 243 × 153). */
function GiftArt({ design, sizes, priority, className }: { design: GiftDesign; sizes: string; priority?: boolean; className?: string }) {
  return (
    <div
      className={cn('relative aspect-[243/153] w-full overflow-hidden rounded-lg', className)}
      style={{ backgroundColor: design.bg }}
    >
      <Image
        src={`/gift-cards/${design.id}.webp`}
        alt={design.phrase}
        lang={design.lang}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
