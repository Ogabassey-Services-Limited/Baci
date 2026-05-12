'use client';

import React from 'react';
import { SheetContent } from '@/components/ui/sheet';
import { useMerchant } from '@/hooks/use-merchant-client';
import { getContrastingTextColor } from '@/lib/color-utils';

/**
 * ThemedSheetContent - A wrapper for SheetContent that applies merchant brand colors
 *
 * Since Sheet components render as portals outside the normal DOM hierarchy,
 * they don't inherit CSS variables from AppBody. This wrapper ensures the
 * --store-* CSS variables are available for ThemedButton and other themed components.
 *
 * @example
 * <Sheet>
 *   <SheetTrigger>Open</SheetTrigger>
 *   <ThemedSheetContent>
 *     <ThemedButton colorRole="primary">Button with correct colors</ThemedButton>
 *   </ThemedSheetContent>
 * </Sheet>
 */
export const ThemedSheetContent = React.forwardRef<
  React.ElementRef<typeof SheetContent>,
  React.ComponentPropsWithoutRef<typeof SheetContent>
>(({ style, ...props }, ref) => {
  const { merchant } = useMerchant();

  // Define CSS variables for themed components within the Sheet portal
  const themeStyle = merchant?.brand_colors
    ? ({
        '--store-primary': merchant.brand_colors.primary,
        '--store-background': merchant.brand_colors.background,
        '--store-accent': merchant.brand_colors.accent,
        '--store-primary-text': getContrastingTextColor(
          merchant.brand_colors.primary
        ),
        '--store-background-text': getContrastingTextColor(
          merchant.brand_colors.background
        ),
        '--store-accent-text': getContrastingTextColor(
          merchant.brand_colors.accent
        ),
        ...style,
      } as React.CSSProperties)
    : style;

  return <SheetContent ref={ref} style={themeStyle} {...props} />;
});

ThemedSheetContent.displayName = 'ThemedSheetContent';
