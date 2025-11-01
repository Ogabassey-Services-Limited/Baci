'use client';

import { Input, InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ThemedInputProps extends InputProps {
  focusColor?: 'primary' | 'secondary' | 'accent';
}

/**
 * Input component with branded focus state
 *
 * @example
 * <ThemedInput placeholder="Search..." focusColor="primary" />
 * <ThemedInput type="email" focusColor="accent" />
 */
export function ThemedInput({
  focusColor = 'primary',
  className,
  ...props
}: ThemedInputProps) {
  return (
    <Input
      {...props}
      className={cn(
        // Remove default focus ring
        'focus-visible:ring-0',
        // Add branded focus border
        focusColor === 'primary' && 'focus-visible:border-[var(--store-primary)] focus-visible:ring-1 focus-visible:ring-[var(--store-primary)]',
        focusColor === 'secondary' && 'focus-visible:border-[var(--store-secondary)] focus-visible:ring-1 focus-visible:ring-[var(--store-secondary)]',
        focusColor === 'accent' && 'focus-visible:border-[var(--store-accent)] focus-visible:ring-1 focus-visible:ring-[var(--store-accent)]',
        className
      )}
    />
  );
}
