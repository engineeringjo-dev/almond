import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { PeekCarousel } from '@/components/ui/PeekCarousel';
import { ItemModal } from '@/components/menu/ItemModal';
import { PhotoTile } from '@/components/home/PhotoTile';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { useMenuState } from '@/hooks/useMenuState';
import { useWalletRate } from '@/hooks/useWalletRate';
import { formatJOD } from '@/lib/format';
import { buildHomeSlides, type HomeSlide, type SlideWords } from '@/lib/homeSlides';
import { earnRangeCopy } from '@almond/shared/loyalty';
import type { MenuItem } from '@/types';

/** Existing actionable offers, moved intact from Home to the discovery page.
 *  This is the same manual rail: no autoplay and no decorative photo slides. */
export function MemberOffers() {
  const { t, lang } = useI18n();
  const menu = useMenuState();
  const { rate, base } = useWalletRate();
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const slides = useMemo<HomeSlide[]>(() => buildHomeSlides({
    lang,
    items: menu.items,
    walletRate: { rate, base },
    range: earnRangeCopy(lang),
    formatPrice: (jod) => formatJOD(jod, lang),
  }), [lang, menu.items, rate, base]);
  const words = (w: SlideWords | undefined) => !w ? undefined : 'text' in w ? w.text : t(w.key, w.params);
  const run = (slide: HomeSlide) => {
    if (slide.action.kind === 'route') {
      router.push(slide.action.href);
    } else {
      const { itemId } = slide.action;
      const item = menu.items.find((m) => m.id === itemId);
      if (item) setSelected(item);
    }
  };
  return (
    <View style={styles.section}>
      <Text variant="title" accessibilityRole="header">{t('campaign.moreOffers')}</Text>
      <PeekCarousel
        count={slides.length}
        label={t('campaign.moreOffers')}
        pickLabel={(n, total) => t('home.slidePick', { n, total })}
        bleed={spacing.lg}
        peek={spacing.sm}
        gap={spacing.sm}
        renderSlide={(i, ctx) => {
          const slide = slides[i]!;
          return (
            <PhotoTile
              title={words(slide.title)!}
              subtitle={words(slide.subtitle)}
              cta={words(slide.cta)}
              photos={[slide.photo]}
              icon={slide.icon}
              onPress={ctx.press(() => run(slide))}
              onFocus={ctx.onFocus}
              style={styles.fill}
            />
          );
        }}
      />
      <ItemModal item={selected} visible={!!selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  fill: { flex: 1 },
});
