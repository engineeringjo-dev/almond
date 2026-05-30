import { colors } from '../theme';
import { computeOdds } from '../services/adminApi';
import type { SpinPrize } from '../types';

/** Live odds preview — real % from current weights, normalized to 100 (section 13.2). */
export function OddsPreview({ prizes }: { prizes: SpinPrize[] }) {
  const odds = computeOdds(prizes);
  const enabled = prizes.filter((p) => p.enabled);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {enabled.map((p) => {
        const pct = odds[p.id] ?? 0;
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 130, fontSize: 13 }}>{p.nameAr}</span>
            <div style={{ flex: 1, height: 14, background: colors.cream, borderRadius: 7, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: colors.gold,
                  borderRadius: 7,
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <span style={{ width: 56, textAlign: 'end', fontWeight: 700, fontSize: 13 }}>
              {pct.toFixed(1)}%
            </span>
          </div>
        );
      })}
      {enabled.length === 0 ? (
        <span style={{ color: colors.warmGray, fontSize: 13 }}>لا توجد جوائز مُفعّلة</span>
      ) : null}
    </div>
  );
}
