import {
  View,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { HeroCard } from '@/components/ui/HeroCard';
import { Logo } from '@/components/ui/Logo';
import { Skeleton } from '@/components/ui/Skeleton';
import { PeekCarousel } from '@/components/ui/PeekCarousel';
import { TierBadge, TIER_FILL } from '@/components/loyalty/TierBadge';
import { BonusDayBanner } from '@/components/loyalty/BonusDayBanner';
import { WelcomeGiftNote } from '@/components/loyalty/WelcomeGiftNote';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { formatNumber, formatDayKey, formatJOD } from '@/lib/format';
import { useLoyaltyBalance, useRedeemReward } from '@/hooks/useLoyalty';
// earn-arith-exempt: the tier ramp, for DISPLAY only — no invoice, no grant. §7 T7.
import { tiers } from '@/services/seed';
import { earnRangeCopy, tierName, walletRateName } from '@almond/shared/loyalty';
// earn-arith-exempt: points→JOD for DISPLAY, via the one shared conversion. §7 T7.
import { jodFromPoints } from '@almond/shared/loyalty/earn';
import { redeemOptions, type RedeemOption } from '@almond/shared/loyalty/redeem';
import { tierProgressCopy } from '@/lib/tierCopy';
import i18n from '@/lib/i18n';
import type { Lang, Tier, TierId } from '@/types';

// The rung's fill — one map, the badge's (TierBadge.tsx), in the scheme's
// black-and-white ramp.
const TIER_COLOR: Record<TierId, string> = TIER_FILL;

// Full per-tier benefit lists (each card is self-contained, Starbucks-style).
// Tiers differ ONLY by reward generosity — never by service/treatment.
//
// 🔴 WHAT CAME OFF THESE CARDS, AND WHY. Four rows were promising mechanics the
// code does not run:
//   - earnBean/earnSilver/earnGold/earnBlack said "Earn 5 / 6.25 / 7.5 / 10
//     points per 1 JOD". The code pays 2 / 4 / 6. Every one of them was wrong on
//     screen, in both languages, on ids (bean/silver/gold/black) that stopped
//     existing when the ladder became base/plus/top.
//   - doubleDays4 promised Double Points Days: config.BONUS_BEAN_DAY.enabled is
//     false and WEEKDAY_EARN_BONUS is empty. Retired 2026-09-06.
//   - cupBonus promised double points for a personal cup. No such mechanic
//     exists anywhere in the repo.
//   - reloadBonus was identical at every rung, so listing it as a TIER benefit
//     implied a differentiation it did not carry. It moved to home.walletHint,
//     and was then deleted outright (owner, 2026-10-15: «لا يوجد بونص شحن،
//     البونص للانفاق فقط»); the wallet's bonus is on spending it.
//
// One row replaces all four earn* rows: `tierBenefits.cashback`, whose {{rate}}
// IS the tier's name. 1 point = 1 qirsh exactly (10,621 live redemptions), so
// the rate and the cashback percentage are the same number — "Earn 2 points per
// 1 JOD" said one fact twice in two units, and a string with no numeral in it
// cannot go stale.
//
// 🔴 AND THEN FIVE MORE, 2026-10-15. Owner: «لا تعد بشيء اشطب الوعد بالعيد
// ميلاد» — promise nothing. A birthday drink, a free customisation a month,
// personal offers, coffee experiences and a named member card were on these
// cards; NOTHING in the BFF grants any of them (a birthday is stored, never
// paid). They are deleted, keys and all, and C18 in almond-app/test/copy.test.ts
// fails if any of the five keys comes back. What is left is what the server
// pays: the rung's rate, and the rate when the bill is paid from the balance.
type BenefitParams = (tier: Tier, lang: Lang) => Record<string, string | number>;
type Benefit = { icon: IconName; key: string; params?: BenefitParams };
// The rate row, and the only place a rung's rate is stated on this screen.
const CASHBACK: Benefit = {
  icon: 'bean',
  key: 'tierBenefits.cashback',
  params: (tier, lang) => ({ rate: tierName(tier, lang) }),
};
// The same rung paid from the wallet or gift-card balance (×1.5, read off the
// dials by walletRateName) — real at every rung, and different at every rung.
const WALLET_CASHBACK: Benefit = {
  icon: 'wallet',
  key: 'tierBenefits.walletCashback',
  params: (tier, lang) => ({ rate: walletRateName(tier, lang) }),
};

// `Record<TierId, …>` on purpose: TypeScript makes it exhaustive, so a fourth
// rung cannot be added to the ramp and silently render an empty card.
// Owner, 2026-10-15 — paid by the server on the day of the sale, every rung.
const DOUBLE_DAYS: Benefit = { icon: 'sparkles', key: 'tierBenefits.doubleDays' };

const TIER_BENEFITS: Record<TierId, Benefit[]> = {
  base: [CASHBACK, WALLET_CASHBACK, DOUBLE_DAYS],
  plus: [CASHBACK, WALLET_CASHBACK, DOUBLE_DAYS],
  // 🔴 `tierBenefits.noExpire` ("Your points never expire") used to sit here on
  // the top rung, because the old inactivity rule really did exempt it. Under
  // «لا إعفاء — القاعدة للجميع» every point on every rung lives 12 months from
  // the day it was granted, so the row is gone and so is the string. A benefit
  // the code does not honour is the W4 defect this project has already paid for.
  top: [CASHBACK, WALLET_CASHBACK, DOUBLE_DAYS],
};

const STEPS: { icon: IconName; titleKey: string; bodyKey: string }[] = [
  { icon: 'qr', titleKey: 'rewards.step1Title', bodyKey: 'rewards.step1Body' },
  { icon: 'bean', titleKey: 'rewards.step2Title', bodyKey: 'rewards.step2Body' },
  { icon: 'gift', titleKey: 'rewards.step3Title', bodyKey: 'rewards.step3Body' },
];

export default function RewardsScreen() {
  const { t, lang } = useI18n();
  const balanceQ = useLoyaltyBalance();
  const redeemReward = useRedeemReward();

  if (balanceQ.isError) {
    return <Screen error onRetry={balanceQ.refetch} />;
  }
  if (balanceQ.isLoading || !balanceQ.data) {
    return (
      <Screen>
        <View style={styles.titleRow}>
          <Logo variant="badge" size={28} />
          <Text variant="h1">{t('rewards.title')}</Text>
        </View>
        <Skeleton height={180} style={styles.skelHero} />
        <Skeleton width="55%" height={22} style={styles.skelLine} />
        <View style={styles.rewardGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.rewardCell}>
              <Skeleton height={150} />
            </View>
          ))}
        </View>
      </Screen>
    );
  }

  const balance = balanceQ.data;
  const points = balance.points;

  // The options are built from the BALANCE, in @almond/shared, so this screen
  // and the website offer one member one set of choices. There is no board to
  // be priced against a menu any more — see loyalty/redeem.ts.
  const options = redeemOptions(points);

  const onRedeem = (o: RedeemOption) => {
    if (o.points > points || redeemReward.isPending) return;
    const jod = formatJOD(o.jod, lang);
    // The voucher is a CREDIT worth exactly `o.jod`, not a named item capped at
    // a value: 1 point = 1 qirsh, so there is no cap to disclose and no
    // difference to pay at the till. That is why `rewards.maxValueHint` is gone
    // rather than moved — it described a board that no longer exists.
    const titleFor = (lng: Lang) => i18n.t('rewards.creditVoucher', {
      lng,
      jod: formatJOD(o.jod, lng),
    });
    Alert.alert(t('rewards.confirmTitle'), t('rewards.confirmBody', { jod, points: o.points }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('rewards.redeemCta'),
        onPress: () =>
          redeemReward.mutate(
            {
              beans: o.points,
              titleAr: titleFor('ar'),
              titleEn: titleFor('en'),
              type: 'credit',
              value: o.jod,
            },
            { onSuccess: () => Alert.alert(t('rewards.redeemedTitle'), t('rewards.redeemedBody', { jod })) },
          ),
      },
    ]);
  };

  // The rung the balance ALREADY CARRIES — not tierFromSpend(windowSpend).
  // Those two disagree for any ratcheted member: there is no demotion, so a
  // member whose 90-day window rolled below a threshold they crossed is still
  // paid the higher rate, and re-deriving it here would show them the lower one
  // right next to a TierBadge showing the higher one.
  const curIdx = Math.max(0, tiers.findIndex((tr) => tr.id === balance.tier));
  const currentTier = tiers[curIdx];
  const next = tiers[curIdx + 1] ?? null;
  // The sentence itself is decided in ONE place, in visits, for all three
  // screens — see lib/tierCopy.ts. This screen used to say "Spend 8.000 JOD to
  // reach tiers.plus": a dinar figure the copy rules forbid, next to a literal
  // unresolved i18n key.
  const progress = tierProgressCopy(balance, lang);
  const segFrom = currentTier.threshold;
  const segTo = next ? next.threshold : currentTier.threshold;
  const segPct = next
    ? Math.min(100, Math.max(0, ((balance.windowSpend - segFrom) / (segTo - segFrom)) * 100))
    : 100;

  return (
    <Screen onRefresh={balanceQ.refetch}>
      <View style={styles.titleRow}>
        <Logo variant="badge" size={28} />
        <Text variant="h1">{t('rewards.title')}</Text>
      </View>

      {/* Activatable Double Beans Day (only renders when today qualifies) */}
      <View style={styles.bannerWrap}>
        <BonusDayBanner />
      </View>

      {/* The balance, on the black card */}
      <HeroCard style={styles.pointsCard}>
        <Text variant="caption" color={colors.onHeroMuted}>
          {t('pay.yourPoints')}
        </Text>
        <Text variant="display" color={colors.onHero}>
          {formatNumber(points, lang)}
        </Text>
        <Text variant="caption" color={colors.onHeroMuted}>
          {/* WHICH points, and WHEN — never "your points expire on X" for a
              balance made of grants months apart, and never "your points never
              expire" beside a rule that says every point does. Nothing is
              rendered at all when the member holds no live points. */}
          {balance.nextExpiry
            ? t('rewards.pointsExpireNext', {
                points: formatNumber(balance.nextExpiry.amount, lang),
                date: formatDayKey(balance.nextExpiry.on, lang),
              })
            : ''}
        </Text>
        <View style={styles.tierRow}>
          <TierBadge tier={balance.tier} onHero />
        </View>
        <WelcomeGiftNote points={balance.welcomeBonusPending} color={colors.onHero} />
      </HeroCard>

      {/* «نقاطك نقود» and the whole ladder in one line, read off the dials.
          It said «القهوة المجانية مجرد البداية» (Starbucks' headline) — a
          free coffee nothing here pays. Owner, 2026-10-15: «ازل عبارة القهوة
          المجانية مجرد بداية … نقاط ٢- ٦% واحيانا × ١.٥». */}
      <Text variant="h2" center style={styles.headline}>
        {t('rewards.headline')}
      </Text>
      <Text variant="body" color={colors.warmGray} center style={styles.headlineSub}>
        {t('rewards.headlineSub', earnRangeCopy(lang))}
      </Text>

      {/* §3.1 How it works — one warm card, 3 rows */}
      <Card style={styles.howCard}>
        <Text variant="title" center style={styles.howTitle}>
          {t('rewards.howItWorks')}
        </Text>
        {STEPS.map((s) => (
          <View key={s.titleKey} style={styles.howRow}>
            <View style={styles.howIcon}>
              <Icon name={s.icon} size={22} color={colors.primary} strokeWidth={1.9} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyBold">{t(s.titleKey)}</Text>
              <Text variant="caption" color={colors.warmGray}>
                {t(s.bodyKey)}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      {/* §3.2 Redeem — points are money off the bill, not a board of things.
          The old grid rendered four named rewards at four point costs and told
          the member each was "a max value, pay the difference". None of that is
          true now: 1 point = 1 qirsh, and a redemption is a discount. */}
      <Text variant="title" style={styles.sectionTitle}>
        {t('rewards.redeemTitle')}
      </Text>
      <Text variant="caption" color={colors.warmGray} style={styles.sectionSub}>
        {t('rewards.redeemHint')}
      </Text>

      <Card style={styles.redeemCard}>
        <Text variant="caption" color={colors.warmGray}>
          {t('rewards.worthNow')}
        </Text>
        {/* The balance IN MONEY, big — the one number the member is deciding
            with. The points figure is already in the hero above; repeating it
            here at display size would make them read the same fact twice. */}
        <Text variant="display" color={colors.dark}>
          {formatJOD(jodFromPoints(points), lang)}
        </Text>

        {options.length === 0 ? (
          <Text variant="caption" color={colors.warmGray} center style={styles.redeemEmpty}>
            {t('rewards.noPointsYet')}
          </Text>
        ) : (
          <View style={styles.redeemRow}>
            {options.map((o) => (
              <Pressable
                key={o.id}
                style={styles.redeemChip}
                onPress={() => onRedeem(o)}
                disabled={redeemReward.isPending}
                accessibilityRole="button"
                accessibilityLabel={t('rewards.redeemA11y', {
                  jod: formatJOD(o.jod, lang),
                  points: o.points,
                })}
              >
                <Text variant="bodyBold" color={colors.primary} center>
                  {formatJOD(o.jod, lang)}
                </Text>
                <Text variant="caption" color={colors.warmGray} center>
                  {o.full
                    ? t('rewards.wholeBalance')
                    : t('rewards.costsPoints', { points: o.points })}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>

      {/* §3.3 Status — large, full-colour swipeable cards (Starbucks pattern) */}
      <Text variant="title" style={styles.sectionTitle}>
        {t('rewards.routineTitle')}
      </Text>
      <Text variant="caption" color={colors.warmGray} style={styles.sectionSub}>
        {t('rewards.routineSub')} · {t('rewards.swipeTiers')}
      </Text>

      {/* The tiers, one card at a time with the next one showing: the same
          carousel as Home's offers (PeekCarousel). It was a horizontal
          ScrollView whose page was its offset divided by the card width; the
          web reports that offset as negative in Arabic, so the page came out
          as -1 and the arrows scrolled to an offset the browser clamps to 0. */}
      <PeekCarousel
        count={tiers.length}
        label={t('rewards.routineTitle')}
        pickLabel={(n) => tierName(tiers[n - 1]!, lang)}
        bleed={spacing.lg}
        arrows
        renderSlide={(i) => {
          const tr = tiers[i]!;
          const isCurrent = tr.id === currentTier.id;
          const fg = colors.onInk; // the ramp carries onInk at ≥4.5:1 in both schemes
          // The qualifying door, said the way the member can act on it. The
          // second rung has a REAL visits door (config.TIER2_VISITS_ALTERNATIVE
          // = 4, and ceil(20 / 5.85) = 4 too, so the two doors agree); the top
          // rung has none, so it does not pretend to.
          const sub = tr.id === 'base'
            ? t('rewards.statusSubBase')
            : tr.id === 'plus'
              ? t('rewards.statusSubPlus', { visits: config.TIER2_VISITS_ALTERNATIVE })
              : t('rewards.statusSubTop');
          return (
            <View style={[styles.statusCard, { backgroundColor: TIER_COLOR[tr.id] }]}>
              {isCurrent ? (
                <View style={styles.currentPill}>
                  <Text variant="caption" color={TIER_COLOR[tr.id]} style={styles.currentPillText}>
                    {t('rewards.currentTier')}
                  </Text>
                </View>
              ) : null}

              <Text variant="h2" center color={fg}>
                {tierName(tr, lang)}
              </Text>
              <Text variant="caption" center color={fg} style={styles.statusSub}>
                {sub}
              </Text>

              {isCurrent && progress ? (
                <View style={styles.progressBlock}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${segPct}%` }]} />
                  </View>
                  <Text variant="caption" center color={fg}>
                    {t(progress.key, progress.params)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.benefits}>
                {TIER_BENEFITS[tr.id].map((b) => (
                  <View key={b.key} style={styles.benefitRow}>
                    <Icon name={b.icon} size={16} color={fg} strokeWidth={1.9} />
                    <Text variant="caption" color={fg} style={styles.flex}>
                      {t(b.key, b.params ? b.params(tr, lang) : undefined)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        }}
      />

      {/* History */}
      <Pressable style={styles.historyLink} onPress={() => router.push('/loyalty')} hitSlop={8}>
        <Icon name="history" size={18} color={colors.brown} />
        <Text variant="bodyBold" color={colors.brown}>
          {t('rewards.viewHistory')}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  bannerWrap: { marginBottom: spacing.lg },
  flex: { flex: 1 },
  skelHero: { marginBottom: spacing.lg },
  skelLine: { marginBottom: spacing.md },
  pointsCard: {
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  tierRow: { marginTop: spacing.sm },

  headline: { marginTop: spacing.xl },
  headlineSub: { marginTop: spacing.xs, marginBottom: spacing.lg },

  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionSub: { marginBottom: spacing.md },

  // How it works — one warm card with 3 rows
  howCard: { gap: spacing.lg },
  howTitle: { marginBottom: spacing.xs },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  howIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // The loading skeleton still draws a grid of placeholder cells, so these two
  // survive the board they used to lay out.
  rewardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  rewardCell: { width: '47.5%', flexGrow: 1 },

  redeemCard: { alignItems: 'center', gap: spacing.xs },
  redeemEmpty: { marginTop: spacing.sm },
  redeemRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  redeemChip: {
    flexGrow: 1,
    minWidth: 96,
    // 48dp minimum touch target — the screen is used by every age group and a
    // chip is the only tappable thing on this card.
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.neutralWarm,
  },

  // Status carousel
  statusCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    minHeight: 280,
    ...shadow.card,
  },
  currentPill: {
    alignSelf: 'center',
    backgroundColor: colors.onInk,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    marginBottom: spacing.xs,
  },
  currentPillText: { fontWeight: '700' },
  statusSub: { marginBottom: spacing.md, opacity: 0.9 },
  progressBlock: { gap: spacing.xs, marginBottom: spacing.md },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.onInk,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.onInk },
  benefits: { gap: spacing.sm, marginTop: spacing.xs },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },


  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
});
