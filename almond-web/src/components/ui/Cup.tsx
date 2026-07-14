import { cn } from '@/lib/cn';
import { config } from '@/lib/config';

type CupProps = {
  current?: number;
  target?: number;
  className?: string;
};

/**
 * The loyalty "cup" — a line-art paper cup with the 2-bean logo that fills with
 * coffee toward the free-drink target (CUP_TARGET = 10). Recreated as an SVG for
 * the web (mirrors the app's components/loyalty/Cup.tsx). Uses `currentColor`,
 * so set the colour with a Tailwind text-* class on the wrapper.
 */
export function Cup({ current = 6, target = config.CUP_TARGET, className }: CupProps) {
  const ratio = Math.max(0, Math.min(1, target > 0 ? current / target : 0));
  // Interior of the cup runs from y=44 (under the lid) to y=150 (base).
  const top = 44;
  const bottom = 150;
  const fillY = bottom - (bottom - top) * ratio;

  return (
    <svg
      viewBox="0 0 140 170"
      className={cn('text-primary', className)}
      role="img"
      aria-label={`${current} / ${target}`}
    >
      <defs>
        <clipPath id="almond-cup-clip">
          <path d="M34 44 L106 44 L98 150 Q97 158 89 158 L51 158 Q43 158 42 150 Z" />
        </clipPath>
      </defs>

      {/* Coffee fill */}
      <g clipPath="url(#almond-cup-clip)">
        <rect x="30" y={fillY} width="80" height="120" fill="currentColor" opacity="0.85" />
      </g>

      {/* Cup body */}
      <path
        d="M34 44 L106 44 L98 150 Q97 158 89 158 L51 158 Q43 158 42 150 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* Lid rim + sip lid */}
      <rect x="28" y="32" width="84" height="14" rx="6" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <path d="M52 32 L60 18 L80 18 L88 32" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />

      {/* 2-bean logo */}
      <g stroke="currentColor" strokeWidth="2.6" fill="none">
        <ellipse cx="62" cy="92" rx="7" ry="10" transform="rotate(-18 62 92)" />
        <ellipse cx="78" cy="100" rx="7" ry="10" transform="rotate(-18 78 100)" />
      </g>
    </svg>
  );
}
