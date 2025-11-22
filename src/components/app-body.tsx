
'use client';

import { cn } from '@/lib/utils';
import { getContrastingTextColor } from '@/lib/color-utils';
import type { MerchantData } from '@/hooks/use-merchant';

export default function AppBody({ children, merchant }: { children: React.ReactNode, merchant?: MerchantData | null }) {
  // Define CSS variables for the merchant's theme
  const themeStyle = merchant?.brand_colors ? {
    '--store-primary': merchant.brand_colors.primary,
    '--store-background': merchant.brand_colors.background,
    '--store-accent': merchant.brand_colors.accent,
    '--store-primary-text': getContrastingTextColor(merchant.brand_colors.primary),
    '--store-background-text': getContrastingTextColor(merchant.brand_colors.background),
    '--store-accent-text': getContrastingTextColor(merchant.brand_colors.accent),
  } : {};

  return (
    <div
      className={cn(
        "min-h-screen bg-background font-sans antialiased transition-opacity duration-300 opacity-100"
      )}
      style={themeStyle as React.CSSProperties}
    >
      {children}
    </div>
  );
}
