'use client';

import { Input, type InputProps } from '@/components/ui/input';
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
export const ThemedInput = ({
  focusColor = 'primary',
  className,
  ...props
}: ThemedInputProps) => {
  return (
    <Input
      {...props}
      className={cn(
        // Add branded focus border
        'focus-visible:ring-1',
        focusColor === 'primary' &&
          'focus-visible:border-store-primary focus-visible:ring-store-primary',
        focusColor === 'secondary' &&
          'focus-visible:border-store-secondary focus-visible:ring-store-secondary',
        focusColor === 'accent' &&
          'focus-visible:border-store-accent focus-visible:ring-store-accent',
        className
      )}
    />
  );
};

ThemedInput.displayName = 'ThemedInput';
