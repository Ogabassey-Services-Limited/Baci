'use client';

import Link, { LinkProps } from 'next/link';
import { cn } from '@/lib/utils';

interface ThemedLinkProps extends LinkProps {
  colorRole?: 'primary' | 'secondary' | 'accent';
  children: React.ReactNode;
  className?: string;
  underline?: boolean;
}

/**
 * Link component that uses merchant brand colors
 *
 * @example
 * <ThemedLink href="/about" colorRole="primary">Learn More</ThemedLink>
 * <ThemedLink href="/products" colorRole="accent" underline>Shop Now</ThemedLink>
 */
export function ThemedLink({
  colorRole = 'primary',
  underline = true,
  className,
  children,
  ...props
}: ThemedLinkProps) {
  return (
    <Link
      {...props}
      className={cn(
        'transition-colors',
        // Color based on role
        colorRole === 'primary' && 'text-[var(--store-primary)] hover:text-[var(--store-primary)]/80',
        colorRole === 'secondary' && 'text-[var(--store-secondary)] hover:text-[var(--store-secondary)]/80',
        colorRole === 'accent' && 'text-[var(--store-accent)] hover:text-[var(--store-accent)]/80',
        // Underline style
        underline && 'underline underline-offset-4',
        className
      )}
    >
      {children}
    </Link>
  );
}
