import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'outline' | 'onDark' | 'onDarkOutline';
type Size = 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-pill font-bold transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50';

const SIZES: Record<Size, string> = {
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-7 text-md',
};

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  outline: 'border border-primary text-primary hover:bg-accent-light',
  onDark: 'bg-white text-primary hover:bg-white/90',
  onDarkOutline: 'border border-white/80 text-white hover:bg-white/10',
};

type Props = {
  children: ReactNode;
  href?: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  ariaLabel?: string;
};

/** Brand button. Renders a locale-aware <Link> when `href` is set, else a <button>. */
export function Button({
  children,
  href,
  variant = 'primary',
  size = 'lg',
  className,
  ariaLabel,
}: Props) {
  const classes = cn(BASE, SIZES[size], VARIANTS[variant], className);
  if (href) {
    return (
      <Link href={href} className={classes} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
