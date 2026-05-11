'use client';

import type { Route } from 'next';
import Link from 'next/link';
import React from 'react';
import { cn } from '@/lib/utils';

interface ThemedLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: Route | URL;
  colorRole?: 'primary' | 'secondary' | 'accent';
  children: React.ReactNode;
  underline?: boolean;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
}

/**
 * Link component that uses merchant brand colors
 *
 * @example
 * <ThemedLink href="/about" colorRole="primary">Learn More</ThemedLink>
 * <ThemedLink href="/products" colorRole="accent" underline>Shop Now</ThemedLink>
 */
export const ThemedLink = React.forwardRef<HTMLAnchorElement, ThemedLinkProps>(
  (
    { colorRole = 'primary', underline = true, className, children, ...props },
    ref
  ) => {
    return (
      <Link
        {...props}
        ref={ref}
        className={cn(
          'transition-colors',
          // Color based on role
          colorRole === 'primary' &&
            'text-(--store-primary) hover:text-(--store-primary)/80',
          colorRole === 'secondary' &&
            'text-(--store-secondary) hover:text-(--store-secondary)/80',
          colorRole === 'accent' &&
            'text-(--store-accent) hover:text-(--store-accent)/80',
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
