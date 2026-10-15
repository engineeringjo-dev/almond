import { View, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { colors, spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import { formatDate, formatDayKey, formatNumber } from '@/lib/format';
import { branches } from '@/services/seed';
import { pointsLines, pointsSummary } from '@almond/shared/loyalty/history';
import { ammanDayKey } from '@almond/shared/lib/ammanWeekday';
import type { PointsLogEntry } from '@/types';

/**
 * «سجل النقاط» — the member's points ledger, read the way a member reads it.
 *
 * Owner, 2026-10-15, after Al Ameed's app: «نعمل سجل نقاط مثلهم». Three
 * counters on top (redeemed, visits, expired — loyalty/history.ts counts them,
 * the same function the website uses), then every line with its date, the
 * branch of a purchase, and the day the points it granted run out.
 *
 * The expiry is the lot's OWN stored date, sent by the server with the line;
 * nothing here re-derives it from today's rules. It is shown while it is still
 * ahead: once it has passed, the points are either spent or written off on
 * their own «انتهاء صلاحية نقاط» line.
 */
export function PointsHistory({ entries: ledger }: { entries: readonly PointsLogEntry[] }) {
  const { t, lang } = useI18n();
  // Points only: the wallet's money lines are the wallet's own statement
  // (app/profile/wallet.tsx). Here a top-up read as a line with no figure.
  const entries = pointsLines(ledger);
  const summary = pointsSummary(entries);
  const today = ammanDayKey(new Date());

  const counters = [
    { key: 'redeemed', value: summary.redeemed, label: t('loyalty.summaryRedeemed') },
    { key: 'visits', value: summary.visits, label: t('loyalty.summaryVisits') },
    { key: 'expired', value: summary.expired, label: t('loyalty.summaryExpired') },
  ];

  return (
    <View>
      <Card padded={false} style={styles.counters}>
        {counters.map((c, i) => (
          <View
            key={c.key}
            style={[styles.counter, i > 0 && styles.counterDivider]}
            accessible
            accessibilityLabel={`${formatNumber(c.value, lang)} ${c.label}`}
          >
            <Text variant="title" color={colors.dark} center style={styles.figure}>
              {formatNumber(c.value, lang)}
            </Text>
            <Text variant="caption" color={colors.warmGray} center>
              {c.label}
            </Text>
          </View>
        ))}
      </Card>

      {entries.length === 0 ? (
        <Text variant="caption" color={colors.warmGray}>
          {t('loyalty.noHistory')}
        </Text>
      ) : (
        <Card padded={false} style={styles.card}>
          {entries.map((h, i) => {
            const branch = h.branchId ? branches.find((b) => b.id === h.branchId) : undefined;
            const meta = [
              formatDate(h.createdAt, lang),
              branch ? t('loyalty.historyBranch', { name: lang === 'ar' ? branch.nameAr : branch.nameEn }) : null,
            ].filter(Boolean).join(' · ');
            const expiry = h.deltaPoints > 0 && h.expiresOn && h.expiresOn >= today
              ? t('loyalty.expiresOn', { date: formatDayKey(h.expiresOn, lang, { year: true }) })
              : null;
            return (
              <View key={h.id} style={[styles.row, i > 0 && styles.border]}>
                <View style={styles.body}>
                  <Text variant="body">{lang === 'ar' ? h.reasonAr : h.reasonEn}</Text>
                  <Text variant="caption" color={colors.warmGray}>
                    {meta}
                  </Text>
                  {expiry ? (
                    <Text variant="caption" color={colors.brown}>
                      {expiry}
                    </Text>
                  ) : null}
                </View>
                {h.deltaPoints !== 0 ? (
                  <Text
                    variant="bodyBold"
                    color={h.deltaPoints > 0 ? colors.green : colors.red}
                    style={styles.figure}
                  >
                    {/* Isolated left-to-right, or the sign lands on the
                        number's far side in an Arabic row («40+»). */}
                    {`\u2066${h.deltaPoints > 0 ? '+' : '−'}${formatNumber(Math.abs(h.deltaPoints), lang)}\u2069`}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  counters: { flexDirection: 'row', marginBottom: spacing.md, overflow: 'hidden' },
  counter: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
  counterDivider: { borderStartWidth: 1, borderStartColor: colors.neutralWarm },
  figure: { fontVariant: ['tabular-nums'] },
  card: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
  },
  body: { flex: 1, gap: 2 },
  border: { borderTopWidth: 1, borderTopColor: colors.neutralWarm },
});
