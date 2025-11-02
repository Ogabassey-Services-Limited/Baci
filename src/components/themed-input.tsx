
'use client';

import * as React from 'react';
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
export const ThemedInput = React.forwardRef<HTMLInputElement, ThemedInputProps>(
  ({ focusColor = 'primary', className, ...props }, ref) => {
    return (
      <Input
        {...props}
        ref={ref}
        className={cn(
          // Add branded focus border
          'focus-visible:ring-1',
          focusColor === 'primary' && 'focus-visible:border-[var(--store-primary)] focus-visible:ring-[var(--store-primary)]',
          focusColor === 'secondary' && 'focus-visible:border-[var(--store-secondary)] focus-visible:ring-[var(--store-secondary)]',
          focusColor === 'accent' && 'focus-visible:border-[var(--store-accent)] focus-visible:ring-[var(--store-accent)]',
          className
        )}
      />
    );
  }
);

ThemedInput.displayName = 'ThemedInput';
