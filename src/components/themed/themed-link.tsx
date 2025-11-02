

'use client';

import Link, { LinkProps } from 'next/link';
import { cn } from '@/lib/utils';
import React from 'react';

interface ThemedLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>, LinkProps {
  colorRole?: 'primary' | 'secondary' | 'accent';
  children: React.ReactNode;
  underline?: boolean;
}

/**
 * Link component that uses merchant brand colors
 *
 * @example
 * <ThemedLink href="/about" colorRole="primary">Learn More</ThemedLink>
 * <ThemedLink href="/products" colorRole="accent" underline>Shop Now</ThemedLink>
 */
export const ThemedLink = React.forwardRef<HTMLAnchorElement, ThemedLinkProps>(
  ({ colorRole = 'primary', underline = true, className, children, ...props }, ref) => {
    return (
      <Link
        {...props}
        ref={ref}
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
);

ThemedLink.displayName = 'ThemedLink';
