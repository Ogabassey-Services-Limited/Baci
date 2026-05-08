'use client';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ThemedBadgeProps extends BadgeProps {
  colorRole?: 'primary' | 'secondary' | 'accent';
}

/**
 * Badge component that uses merchant brand colors
 *
 * @example
 * <ThemedBadge colorRole="accent">New</ThemedBadge>
 * <ThemedBadge colorRole="primary" variant="outline">Featured</ThemedBadge>
 */
export function ThemedBadge({
  colorRole = 'primary',
  variant = 'default',
  className,
  ...props
}: ThemedBadgeProps) {
  // For default variant, apply brand colors with smart text color
  if (variant === 'default') {
    return (
      <Badge
        {...props}
        variant={variant}
        className={cn(
          // Use CSS custom properties with smart text color
          colorRole === 'primary' &&
            'bg-(--store-primary) text-(--store-primary-text) hover:bg-(--store-primary)/80 border-transparent',
          colorRole === 'secondary' &&
            'bg-(--store-secondary) text-(--store-secondary-text) hover:bg-(--store-secondary)/80 border-transparent',
          colorRole === 'accent' &&
            'bg-(--store-accent) text-(--store-accent-text) hover:bg-(--store-accent)/80 border-transparent',
          className
        )}
      />
    );
  }

  // For outline variant, use border colors
  if (variant === 'outline-solid') {
    return (
      <Badge
        {...props}
        variant={variant}
        className={cn(
          'bg-transparent',
          colorRole === 'primary' &&
            'border-(--store-primary) text-(--store-primary)',
          colorRole === 'secondary' &&
            'border-(--store-secondary) text-(--store-secondary)',
          colorRole === 'accent' &&
            'border-(--store-accent) text-(--store-accent)',
          className
        )}
      />
    );
  }

  // For destructive variant
  if (variant === 'destructive') {
    return <Badge {...props} variant="destructive" className={className} />;
  }

  // For other variants, use default Badge behavior
  return <Badge {...props} variant={variant} className={className} />;
}
