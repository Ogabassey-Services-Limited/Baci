'use client';

import { Card, CardProps } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ThemedCardProps extends CardProps {
  borderColor?: 'primary' | 'secondary' | 'accent' | 'none';
  accentPosition?: 'top' | 'left' | 'none';
  children?: React.ReactNode;
}

/**
 * Card component with optional branded border or accent
 *
 * @example
 * <ThemedCard borderColor="primary">...</ThemedCard>
 * <ThemedCard accentPosition="top">...</ThemedCard>
 */
export function ThemedCard({
  borderColor = 'none',
  accentPosition = 'none',
  className,
  children,
  ...props
}: ThemedCardProps) {
  return (
    <Card
      {...props}
      className={cn(
        // Border colors
        borderColor === 'primary' && 'border-[var(--store-primary)]',
        borderColor === 'secondary' && 'border-[var(--store-secondary)]',
        borderColor === 'accent' && 'border-[var(--store-accent)]',

        // Accent bars
        accentPosition === 'top' && 'border-t-4 border-t-[var(--store-primary)]',
        accentPosition === 'left' && 'border-l-4 border-l-[var(--store-primary)]',

        className
      )}
    >
      {children}
    </Card>
  );
}
