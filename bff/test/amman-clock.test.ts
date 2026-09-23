import { describe, expect, it } from 'vitest';
import { ammanDayKey, ammanMinuteOfDay, ammanWeekday } from '@almond/shared/lib/ammanWeekday';

/**
 * The Amman clock helpers cache their Intl formatters (a fresh formatter per
 * call capped /v1/me/balance at ~1.5k req/s — docs/LOAD-BASELINE.md). Caching
 * must not change a single answer, so this compares them against formatters
 * built fresh per call over instants spanning 2019–2026 — across October 2022,
 * when Jordan abolished DST and moved from UTC+2 winters to UTC+3 all year. A
 * hard-coded +3 would diverge on ~14% of these; Intl must not.
 */
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TZ = 'Asia/Amman';

function reference(d: Date) {
  const weekday = WD.indexOf(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d));
  const dayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { weekday, dayKey, minute: n('hour') * 60 + n('minute') };
}

describe('Amman clock helpers', () => {
  it('match per-call formatters on 20,000 instants across the 2022 DST abolition', () => {
    const start = Date.UTC(2019, 0, 1);
    const step = Math.floor((Date.UTC(2027, 0, 1) - start) / 20_000);
    let differences = 0;
    for (let i = 0; i < 20_000; i++) {
      const d = new Date(start + i * step + ((i * 7919) % 3_600_000));
      const ref = reference(d);
      if (
        ammanWeekday(d) !== ref.weekday ||
        ammanDayKey(d) !== ref.dayKey ||
        ammanMinuteOfDay(d) !== ref.minute
      ) differences++;
    }
    expect(differences).toBe(0);
  });

  it('reads Amman, not the host: 21:30Z on 2026-09-23 is 00:30 on the 24th', () => {
    const d = new Date('2026-09-23T21:30:00.000Z');
    expect(ammanDayKey(d)).toBe('2026-09-24');
    expect(ammanMinuteOfDay(d)).toBe(30);
    expect(ammanWeekday(d)).toBe(4); // Thursday
  });

  it('was UTC+2 in winter before October 2022: 22:30Z on 2021-12-01 is 00:30 on the 2nd', () => {
    const d = new Date('2021-12-01T22:30:00.000Z');
    expect(ammanDayKey(d)).toBe('2021-12-02');
    expect(ammanMinuteOfDay(d)).toBe(30);
  });
});
