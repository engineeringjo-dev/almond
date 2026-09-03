/** THE definition of "which business day is this" for the whole system.
 *  Asia/Amman, not the host clock. Every weekday-sensitive rule — the earn
 *  weekday bonus, the bonus day, the daily subscription cap, the free-spin day
 *  — must go through this module or its ammanDayKey() sibling.
 *  See docs/LOYALTY-EARN-PATCH.md §3.6. */
const AMMAN = 'Asia/Amman';
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ammanWeekday(at: Date = new Date()): number {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: AMMAN, weekday: 'short',
  }).format(at);
  return WD.indexOf(short);
}

/** 'YYYY-MM-DD' in Amman — replaces the UTC todayKey() at mock:49 and memory.ts:88. */
export function ammanDayKey(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AMMAN, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at);
}
