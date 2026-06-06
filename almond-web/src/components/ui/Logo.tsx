import Image from 'next/image';
import { cn } from '@/lib/cn';

type LogoProps = {
  /** `dark` ink (for light backgrounds) or `light` ink (for dark/gradient ones). */
  variant?: 'dark' | 'light';
  /** Full wordmark or the square badge. */
  kind?: 'logo' | 'badge';
  className?: string;
  priority?: boolean;
};

const SRC = {
  logo: { dark: '/logo/almond-logo-dark.png', light: '/logo/almond-logo-light.png' },
  badge: { dark: '/logo/almond-badge-dark.png', light: '/logo/almond-badge-light.png' },
} as const;

// Intrinsic pixel sizes (so CSS height + w-auto keeps the true aspect ratio).
const DIM = { logo: { w: 1600, h: 695 }, badge: { w: 1024, h: 1024 } } as const;

export function Logo({ variant = 'dark', kind = 'logo', className, priority }: LogoProps) {
  const { w, h } = DIM[kind];
  return (
    <Image
      src={SRC[kind][variant]}
      alt="Almond Coffee House"
      width={w}
      height={h}
      priority={priority}
      className={cn('w-auto select-none', className)}
    />
  );
}
