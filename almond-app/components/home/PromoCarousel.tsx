import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { PeekCarousel } from '@/components/ui/PeekCarousel';
import { ItemModal } from '@/components/menu/ItemModal';
import { ComboOfferCard, comboOffer } from '@/components/home/ComboOfferCard';
import { PhotoTile } from '@/components/home/PhotoTile';
import { spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useMenuState } from '@/hooks/useMenuState';
import { useWalletRate } from '@/hooks/useWalletRate';
import { formatJOD } from '@/lib/format';
import { buildHomeSlides, type HomeSlide, type SlideWords } from '@/lib/homeSlides';
import { earnRangeCopy } from '@almond/shared/loyalty';
import type { MenuItem } from '@/types';

/**
 * «العروض» — HOME'S OFFERS, ONE CAROUSEL WITH THE NEIGHBOURS SHOWING.
 *
 * Owner, 2026-10-15: «اسحب الصور من اودو … لنعملها قابلة للاستكشاف مثل البار
 * العلوي بالعميد». The slides, in order:
 * 1. The combo (ComboOfferCard), with a photograph of the pair it adds.
 * 2. The most ordered drink and the most ordered food, measured from paid
 *    orders, with their Odoo photographs.
 * 3. What the programme pays: paying from the balance, gift cards, points.
 *
 * It replaces four Home blocks: the offers strip, «الأكثر طلباً», the wallet
 * card's hint and the gift-card card. The owner's own campaign pictures join
 * as slides when they arrive.
 *
 * 🔴 WHAT CAME OFF THE OLD STRIP, AND WHY. Three tiles, all hardcoded bilingual
 * literals rather than locale keys — which is precisely why W4's locale sweep
 * could not see them and why they outlived the mechanics they promised:
 *   - `combo`, «مشروب + طعام = 50 نقطة»: a literal beside a dial that went
 *     50 → 25 → 50. It is ComboOfferCard now, counting from the dial.
 *   - `friday`, "+50% points every Friday": retired 2026-09-06, deleted.
 *   - `wallet`, "Top up your wallet, earn +50% points": a hardcoded rate. The
 *     wallet slide says it through `home.walletHint`, with the member's own
 *     rate from the balance (useWalletRate).
 * No slide carries a literal in either language (lib/homeSlides.ts).
 */
export function PromoCarousel() {
  const { t, lang } = useI18n();
  const menu = useMenuState();
  const { rate, base } = useWalletRate();
  const [selected, setSelected] = useState<MenuItem | null>(null);

  const slides = useMemo<HomeSlide[]>(
    () =>
      buildHomeSlides({
        lang,
        items: menu.items,
        walletRate: { rate, base },
        range: earnRangeCopy(lang),
        formatPrice: (jod) => formatJOD(jod, lang),
      }),
    [lang, menu.items, rate, base],
  );

  const hasCombo = comboOffer(lang) !== null;
  const count = slides.length + (hasCombo ? 1 : 0);
  const words = (w: SlideWords | undefined) => (!w ? undefined : 'text' in w ? w.text : t(w.key, w.params));

  const run = (s: HomeSlide) => {
    if (s.action.kind === 'route') {
      router.push(s.action.href);
      return;
    }
    const { itemId } = s.action;
    const item = menu.items.find((m) => m.id === itemId);
    if (item) setSelected(item);
  };

  return (
    <>
      <PeekCarousel
        count={count}
        label={t('home.promotions')}
        pickLabel={(n, total) => t('home.slidePick', { n, total })}
        bleed={spacing.lg}
        renderSlide={(i, ctx) => {
          if (hasCombo && i === 0) return <ComboOfferCard onFocus={ctx.onFocus} press={ctx.press} />;
          const s = slides[hasCombo ? i - 1 : i]!;
          return (
            <PhotoTile
              title={words(s.title)!}
              subtitle={words(s.subtitle)}
              cta={words(s.cta)}
              photos={[s.photo]}
              icon={s.icon}
              onPress={ctx.press(() => run(s))}
              onFocus={ctx.onFocus}
              style={styles.fill}
            />
          );
        }}
      />
      <ItemModal item={selected} visible={!!selected} onClose={() => setSelected(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  // Every slide as tall as the tallest, so the row does not step.
  fill: { flex: 1 },
});
