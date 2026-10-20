import type { Lang } from '../types';
import { ltrIsolate, toWesternDigits } from './phone';

/**
 * Almond operates in Jordan — Asia/Amman, permanently UTC+3 (no DST since 2022).
 * Every timestamp that crosses a system boundary (order → Odoo → Ishbek → POS)
 * MUST carry this explicit offset. A bare UTC `Z` stamp read as local time lands
 * ±3h off and the order fails to reflect on the point of sale (نقطة البيع).
 */
export const AMMAN_TZ = 'Asia/Amman';

/**
 * Serialize an instant as ISO-8601 with an explicit Asia/Amman offset
 * (e.g. `2026-07-05T13:06:00.000+03:00`) — never a bare `Z`. The offset is
 * derived from the zone for the given instant, so it stays correct if the
 * rule ever changes. Use this for every order/dispatch/webhook timestamp.
 */
export function toAmmanISO(date: Date | number | string = new Date()): string {
  const d = date instanceof Date ? date : new Date(date);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: AMMAN_TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  // Offset (minutes) = Amman wall-clock read as UTC, minus the real instant.
  const asUTC = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second,
  );
  const offsetMin = Math.round((asUTC - d.getTime()) / 60000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, '0');
  const om = String(abs % 60).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${ms}${sign}${oh}:${om}`;
}

/**
 * JOD ↔ integer FILS (1 JOD = 1000 fils) — the representation every money
 * comparison and every till amount is made in, so 0.1 + 0.2 never reaches a
 * ledger. Moved here from bff/src/money.ts (which now re-exports these) when
 * the till's refund rule moved into @almond/shared: one money rule, one
 * implementation, whichever side of the wire does the arithmetic.
 */
export const toFils = (jod: number): number => Math.round(jod * 1000);
export const toJod = (fils: number): number => Math.round(fils) / 1000;

// Reuse the fixed display formatter across menu rows and re-renders.
const JOD_DISPLAY = new Intl.NumberFormat('en-US', {
  useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/**
 * Customer display uses two decimals: AR `X.XX د.أ` | EN `JOD X.XX`.
 * Owner, 2026-10-19: «خانتان (كما بناه Codex)» (docs/HANDOVER.md §7).
 * Intl rounds decimal half boundaries consistently (1.005 → 1.01). This is
 * presentation only: raw JOD, integer fils and accounting keep their precision.
 */
export function formatJOD(amount: number, lang: Lang): string {
  const value = JOD_DISPLAY.format(amount === 0 ? 0 : amount);
  return lang === 'ar' ? `${value} د.أ` : `JOD ${value}`;
}

/**
 * TWO DECIMALS, ROUNDED TOWARD WHAT THE MEMBER CAN ACT ON. formatJOD rounds
 * half up both ways, which is right for a price and wrong for these two:
 *
 * - An amount the member still NEEDS («اصرف X إضافية») rounds UP to the next
 *   0.01. Rounded to nearest, 18.512 read 18.51; a member who spent exactly
 *   that stayed on 19.998, below the 20 JOD rung, and was then told «0.00»
 *   (review of PRs #103 and #104, item 5).
 * - Money the member HOLDS (a wallet balance, what points are worth, what is
 *   left to send today) rounds DOWN, so a screen never shows more than can be
 *   paid: a balance of 7.448 read 7.45, and a transfer of 7.45 was refused
 *   (the same review, item 7).
 *
 * Both work in integer fils (toFils), never `jod * 100`: 1.1 * 100 is
 * 110.00000000000001 and 0.57 * 100 is 56.99999999999999, so a float ceil or
 * floor would move an amount that is already a whole qirsh (0.01 JOD).
 * Display only, like formatJOD: what is charged and compared stays in fils.
 */
export const roundUpToQirsh = (jod: number): number => Math.ceil(toFils(jod) / 10) / 100;
export const roundDownToQirsh = (jod: number): number => Math.floor(toFils(jod) / 10) / 100;

/** An amount the member still needs, never shown short: 18.512 → «18.52». */
export function formatJODNeeded(amount: number, lang: Lang): string {
  return formatJOD(roundUpToQirsh(amount), lang);
}

/** Money the member holds, never shown above what it pays: 1.005 → «1.00». */
export function formatJODHeld(amount: number, lang: Lang): string {
  return formatJOD(roundDownToQirsh(amount), lang);
}

/**
 * CAN THE WALLET PAY THIS BILL, AS THE MEMBER READS BOTH FIGURES?
 *
 * The wallet line shows its balance rounded DOWN (formatJODHeld) and the total
 * beside it shows the bill rounded to nearest (formatJOD). Enabled on the
 * exact amounts alone, a wallet of 2.927 against a bill of 2.925 read «2.92»
 * beside «2.93» and could still be chosen (reviewers, 2026-10-20). So the
 * wallet pays only when the exact balance covers the exact bill (the server's
 * rule: it charges fils) AND the figure shown for it is not below the total
 * shown. The cost: a wallet less than a qirsh above a bill with a third fils
 * digit is offered as short, which is what both figures on the screen say.
 * In integer fils, as formatJOD rounds: half up to the qirsh.
 */
export function walletCoversShown(wallet: number, total: number): boolean {
  const w = toFils(wallet);
  const t = toFils(total);
  return w >= t && Math.floor(w / 10) >= Math.round(t / 10);
}

/**
 * A MOVEMENT of money, signed: «+20.00 د.أ», «−3.25 د.أ» / "+JOD 20.00".
 *
 * In an Arabic line the sign and the digits must be one left-to-right run (an
 * isolate), or the bidi algorithm puts the sign on the number's far side
 * («3.25−»). Only the signed NUMBER is isolated: isolating the currency with
 * it put «د.أ» before the number for an Arabic reader (the wallet statement,
 * 2026-10-15). Zero has no sign.
 */
export function formatSignedJOD(amount: number, lang: Lang): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '\u2212' : '';
  const value = JOD_DISPLAY.format(Math.abs(amount));
  return lang === 'ar' ? `\u2066${sign}${value}\u2069 د.أ` : `${sign}JOD ${value}`;
}

/**
 * Integer with thousands separators (e.g. points). Uses Latin (Western) digits
 * in BOTH languages so points read consistently with prices (formatJOD), which
 * matches Jordanian commercial convention. `lang` kept for API stability.
 */
export function formatNumber(value: number, _lang: Lang): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * ONE DIGIT SYSTEM ON A SCREEN. Money and points are Latin in both languages
 * (Jordanian commercial convention, above), but `Intl('ar-JO')` writes dates
 * and times in Arabic-Indic digits — so a previous-orders card printed
 * «٣٠ أيلول» beside «3.500 د.أ» (audit P2). Dates and times now ask for the
 * Latin numbering system explicitly (`-u-nu-latn` + `numberingSystem`), and
 * the output is folded to Latin as well, for any engine that ignores both
 * (older Hermes/ICU builds). AM/PM words stay Arabic; dates below use the
 * owner's fixed day/month/year order rather than locale-dependent ordering.
 */
export const DATE_LOCALE: Record<Lang, string> = { ar: 'ar-JO-u-nu-latn', en: 'en-US' };

function formatDateTime(d: Date, lang: Lang, options: Intl.DateTimeFormatOptions): string {
  return toWesternDigits(
    new Intl.DateTimeFormat(DATE_LOCALE[lang], { ...options, numberingSystem: 'latn' }).format(d),
  );
}

/** Short time HH:MM for a given ISO/date. */
export function formatTime(date: string | Date, lang: Lang): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDateTime(d, lang, { timeZone: AMMAN_TZ, hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: string | Date, lang: Lang): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatCalendarDate(d, lang, AMMAN_TZ);
}

/** Full dates always read DD/MM/YYYY, even when the locale orders month
 * first. Parts retain the correct calendar/time zone without borrowing the
 * host's ordering, separators or digits. Arabic embeds one LTR date run. */
function formatCalendarDate(d: Date, lang: Lang, timeZone: string, year = true): string {
  const parts = new Intl.DateTimeFormat(DATE_LOCALE[lang], {
    timeZone, calendar: 'gregory', numberingSystem: 'latn',
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(d);
  const part = (type: 'day' | 'month' | 'year', width: number) =>
    toWesternDigits(parts.find((p) => p.type === type)!.value).padStart(width, '0');
  const date = `${part('day', 2)}/${part('month', 2)}${year ? `/${part('year', 4)}` : ''}`;
  return lang === 'ar' ? ltrIsolate(date) : date;
}

/**
 * Format an AMMAN DAY KEY ('YYYY-MM-DD') for display.
 *
 * 🔴 SEPARATE FROM formatDate ON PURPOSE. `formatDate` takes an INSTANT, and
 * handing it a bare day key goes through `new Date('2026-11-15')`, which the
 * spec parses as UTC MIDNIGHT — so on any host west of Greenwich it renders as
 * 14 November. The point-expiry ledger (loyalty/lots.ts) enforces the day the
 * key names, so printing the day before it is telling the member their points
 * die a day earlier than they do. A day key is a calendar fact, not a moment;
 * it is formatted from its own parts, in UTC, and never converted.
 */
export function formatDayKey(day: string, lang: Lang, opts: { year?: boolean } = {}): string {
  const [y, m, d] = day.split('-').map(Number);
  return formatCalendarDate(new Date(Date.UTC(y, m - 1, d)), lang, 'UTC', opts.year !== false);
}
