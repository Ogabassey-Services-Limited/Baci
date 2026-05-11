'use client';

import { Card, type CardProps } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ThemedCardProps extends CardProps {
  borderColor?: 'primary' | 'secondary' | 'accent' | 'none';
  accentPosition?: 'top' | 'left' | 'none';
  accentColor?: 'primary' | 'secondary' | 'accent';
  children?: React.ReactNode;
}

/**
 * Card component with optional branded border or accent.
 *
 * @example
 * <ThemedCard borderColor="primary">...</ThemedCard>
 * <ThemedCard accentPosition="top" accentColor="accent">...</ThemedCard>
 */
export function ThemedCard({
  borderColor = 'none',
  accentPosition = 'none',
  accentColor = 'primary',
  className,
  children,
  ...props
}: ThemedCardProps) {
  return (
    <Card
      {...props}
      className={cn(
        'relative', // Add relative positioning for the accent bar
        // Border colors
        borderColor === 'primary' && 'border-(--store-primary)',
        borderColor === 'secondary' && 'border-(--store-secondary)',
        borderColor === 'accent' && 'border-(--store-accent)',

        // Accent bars
        accentPosition === 'top' && 'pt-1.5',
        accentPosition === 'left' && 'pl-1.5',

        className
      )}
    >
      {accentPosition !== 'none' && (
        <div
          className={cn('absolute', {
            'top-0 left-0 right-0 h-1.5': accentPosition === 'top',
            'top-0 bottom-0 left-0 w-1.5': accentPosition === 'left',
            'bg-(--store-primary)': accentColor === 'primary',
            'bg-(--store-secondary)': accentColor === 'secondary',
            'bg-(--store-accent)': accentColor === 'accent',
          })}
        />
      )}
      {children}
    </Card>
  );
}
