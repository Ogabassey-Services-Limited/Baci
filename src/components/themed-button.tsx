'use client';

import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ThemedButtonProps extends ButtonProps {
  colorRole?: 'primary' | 'secondary' | 'accent';
}

/**
 * Button component that automatically uses merchant brand colors
 * with smart contrast-aware text colors
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
          colorRole === 'primary' && 'bg-[var(--store-primary)] text-[var(--store-primary-text)] hover:bg-[var(--store-primary)]/90',
          colorRole === 'secondary' && 'bg-[var(--store-secondary)] text-[var(--store-secondary-text)] hover:bg-[var(--store-secondary)]/90',
          colorRole === 'accent' && 'bg-[var(--store-accent)] text-[var(--store-accent-text)] hover:bg-[var(--store-accent)]/90',
          className
        )}
        style={style}
      />
    );
  }

  // For other variants, use default Button behavior
  return <Button {...props} variant={variant} className={className} style={style} />;
}
