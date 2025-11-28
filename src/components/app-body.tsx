
'use client';

import { cn } from '@/lib/utils';
import { getContrastingTextColor } from '@/lib/color-utils';
import type { MerchantData } from '@/hooks/use-merchant';
import { CookieConsent } from '@/components/storefront/cookie-consent';
import { NewsletterWidget } from '@/components/storefront/newsletter-widget';

export default function AppBody({
  children,
  merchant,
  showNewsletterWidget = true
}: {
  children: React.ReactNode,
  merchant?: MerchantData | null,
  showNewsletterWidget?: boolean
}) {
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
      {showNewsletterWidget && <NewsletterWidget position="bottom-left" showDelay={5000} />}
      <CookieConsent />
    </div>
  );
}
