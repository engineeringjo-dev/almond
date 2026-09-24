/** JOD is stored as integer fils (1 JOD = 1000 fils) to avoid float drift.
 *  THE conversion lives in @almond/shared/lib/format (one money rule, one
 *  implementation); re-exported so import paths do not churn. */
export { toFils, toJod } from '@almond/shared/lib/format';
