import { VisitRatingSheet } from '@/components/loyalty/VisitRatingSheet';
import { useI18n } from '@/hooks/useI18n';
import { branches } from '@/services/seed';
import { useVisitSheetStore } from '@/stores/visitSheetStore';

/**
 * «شكراً لزيارتك» — after a purchase that went through the member's account,
 * the next time the app opens (or comes back to the foreground) it says how
 * many points that visit added and asks for a rating of its branch.
 *
 * Owner, 2026-10-15, after Al Ameed's app: «ابني لقطة التقييم واضافة النقاط».
 * Which visit, and whether to ask at all, is the server's shared rule
 * (loyalty/visitRating.ts) plus lib/launchSheet.ts; this only draws it.
 * Mounted ONCE, in app/_layout.tsx.
 */
export function PostVisitSheet() {
  const { lang } = useI18n();
  const visit = useVisitSheetStore((s) => s.visit);
  const close = useVisitSheetStore((s) => s.close);
  if (!visit) return null;
  const branch = branches.find((b) => b.id === visit.branchId);
  return (
    <VisitRatingSheet
      visible
      onClose={close}
      visitRef={visit.ref}
      branchName={branch ? (lang === 'ar' ? branch.nameAr : branch.nameEn) : null}
      pointsAdded={visit.points}
    />
  );
}
