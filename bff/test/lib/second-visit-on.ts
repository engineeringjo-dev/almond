/**
 * THE SECOND-VISIT VOUCHER («تانية علينا») IS OFF IN THE SHIPPED CONFIG —
 * owner, 2026-09-24: «نلغي من التطبيق المشروب الثاني علينا».
 *
 * Its engine, storage and routes are kept so it can come back with one flag,
 * and the files that import this module test THAT engine — so they run it on.
 * Imported for its side effect, as the FIRST import, so the flag is set before
 * any module-level `secondVisitRulesFromConfig()` reads it. Vitest isolates
 * modules per test file, so this cannot leak into a file that tests the
 * shipped state; bff/test/smoke.test.ts S2/S6 pin that state itself.
 */
import { config } from '@almond/shared/config';

(config.SECOND_VISIT_VOUCHER as { enabled: boolean }).enabled = true;
