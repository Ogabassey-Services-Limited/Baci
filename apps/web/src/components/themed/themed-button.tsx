'use client';

import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ThemedButtonProps extends ButtonProps {
  colorRole?: 'primary' | 'background' | 'accent';
}

/**
 * Button component that automatically uses merchant brand colors
 * with smart contrast-aware text colors.
 *
 * @example
 * <ThemedButton colorRole="primary">Shop Now</ThemedButton>
 * <ThemedButton colorRole="accent">Add to Cart</ThemedButton>
 */
export function ThemedButton({
  colorRole = 'primary',
  className,
  variant = 'default',
  style,
  ...props
}: ThemedButtonProps) {
  // For default variant, apply brand colors
  if (variant === 'default') {
    return (
      <Button
        {...props}
        variant={variant}
        className={cn(
          // Use CSS custom properties with smart text color
          colorRole === 'primary' &&
            'bg-(--store-primary) text-(--store-primary-text) hover:bg-(--store-primary)/90',
          colorRole === 'background' &&
            'bg-(--store-background) text-(--store-background-text) hover:bg-(--store-background)/90',
          colorRole === 'accent' &&
            'bg-(--store-accent) text-(--store-accent-text) hover:bg-(--store-accent)/90',
          className
        )}
        style={style}
      />
    );
  }

  // For outline variant, apply border and text colors
  if (variant === 'outline') {
    return (
      <Button
        {...props}
        variant={variant}
        className={cn(
          'bg-transparent',
          colorRole === 'primary' &&
            'border-(--store-primary) text-(--store-primary) hover:bg-(--store-primary)/10',
          colorRole === 'background' &&
            'border-(--store-background) text-(--store-background) hover:bg-(--store-background)/10',
          colorRole === 'accent' &&
            'border-(--store-accent) text-(--store-accent) hover:bg-(--store-accent)/10',
          className
        )}
        style={style}
      />
    );
  }

  // For other variants, use default Button behavior
  return (
    <Button {...props} variant={variant} className={className} style={style} />
  );
}
