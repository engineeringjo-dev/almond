import { config } from '../config';
import type { PointsKind } from './history';

/**
 * THE THANK-YOU AFTER A VISIT.
 *
 * Owner, 2026-10-15, after Al Ameed's app: «ابني لقطة التقييم واضافة النقاط».
 * After paying at the till, Al Ameed's app greets the member with how many
 * points were just added and a 1-5 star rating of the branch, with an optional
 * comment. Starbucks and Careem ask the same way after a visit or a delivery:
 * once, about that one visit, and never again if it is answered or waved away.
 *
 * A visit is a `purchase` line in the points history (loyalty/history.ts) — an
 * app order or a till sale — named by the line's `sourceRef`: "order:<id>" or
 * "pos:<the till's order reference>". One rating per visit per member.
 *
 * Rating pays nothing. The owner struck every promise the programme does not
 * keep («لا تعد بشيء»), and a rating bought with points measures the points.
 */

/** A visit the member may be asked to rate. */
export interface PendingVisit {
  /** "order:<id>" | "pos:<ref>" — the history line's sourceRef. */
  ref: string;
  branchId: string;
  /** Points the purchase granted (0 for a corporate member or a small bill). */
  points: number;
  /** ISO instant of the purchase. */
  at: string;
}

export interface VisitRating {
  ref: string;
  branchId: string;
  stars: number;
  comment: string | null;
  createdAt: string;
}

export interface VisitRatingRules {
  promptDays: number;
  /** Minutes before an app order ("order:…") is asked about. */
  orderDelayMinutes: number;
  commentMax: number;
}

export function visitRatingRulesFromConfig(): VisitRatingRules {
  return {
    promptDays: config.VISIT_RATING_PROMPT_DAYS,
    orderDelayMinutes: config.VISIT_RATING_ORDER_DELAY_MINUTES,
    commentMax: config.VISIT_RATING_COMMENT_MAX,
  };
}

interface VisitLine {
  kind?: PointsKind | null;
  sourceRef?: string | null;
  branchId?: string | null;
  deltaPoints: number;
  createdAt: string;
}

/** Is this history line a visit that can be rated at all? */
export function isRateableVisit(line: VisitLine): line is VisitLine & { sourceRef: string; branchId: string } {
  return line.kind === 'purchase' && !!line.sourceRef && !!line.branchId;
}

/**
 * The ONE visit to ask about now, or null.
 *
 * The NEWEST rateable purchase, if it is within `promptDays` and not yet rated.
 * An APP order waits `orderDelayMinutes` first: placing it is not the visit,
 * collecting it is. A till purchase is asked about at once.
 *
 * Deliberately not "the newest UNRATED one": a member who did not rate
 * yesterday's visit and bought again today is asked about today, and
 * yesterday is not dug back up — one question per visit, about the visit the
 * member remembers.
 */
export function pendingVisit(
  lines: readonly VisitLine[],
  rated: ReadonlySet<string>,
  at: Date,
  rules: VisitRatingRules = visitRatingRulesFromConfig(),
): PendingVisit | null {
  let newest: (VisitLine & { sourceRef: string; branchId: string }) | null = null;
  for (const l of lines) {
    if (!isRateableVisit(l)) continue;
    if (!newest || Date.parse(l.createdAt) > Date.parse(newest.createdAt)) newest = l;
  }
  if (!newest) return null;
  if (rated.has(newest.sourceRef)) return null;
  const age = at.getTime() - Date.parse(newest.createdAt);
  if (age < 0 || age > rules.promptDays * 86_400_000) return null;
  // An app order not yet collected: not yet — and not an older visit instead.
  if (newest.sourceRef.startsWith('order:') && age < rules.orderDelayMinutes * 60_000) return null;
  return { ref: newest.sourceRef, branchId: newest.branchId, points: Math.max(0, newest.deltaPoints), at: newest.createdAt };
}

/** Stars are a whole number from 1 to 5. */
export function isValidStars(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5;
}

/** A comment as stored: trimmed, empty → null, cut to the maximum. */
export function normalizeComment(raw: string | null | undefined, rules: VisitRatingRules = visitRatingRulesFromConfig()): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  return Array.from(t).slice(0, rules.commentMax).join('');
}
