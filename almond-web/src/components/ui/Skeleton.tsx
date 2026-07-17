import { cn } from '@/lib/cn';

/**
 * Neutral shimmer block for loading / hydration states. The pulse is disabled
 * automatically for users who prefer reduced motion (global CSS guard).
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-neutral-warm', className)} aria-hidden />;
}

/**
 * Generic page-level placeholder shown while a client-persisted view hydrates,
 * so the first paint is a calm skeleton instead of a blank flash.
 */
export function PageSkeleton() {
  return (
    <div className="container-content py-xl" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}
