
'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { getContrastingTextColor } from '@/lib/color-utils';
import type { MerchantData } from '@/hooks/use-merchant';

// Lazy-load non-critical widgets to reduce initial JS bundle
const CookieConsent = dynamic(
  () => import('@/components/storefront/cookie-consent').then(mod => ({ default: mod.CookieConsent })),
  { ssr: false }
);

const NewsletterWidget = dynamic(
  () => import('@/components/storefront/newsletter-widget').then(mod => ({ default: mod.NewsletterWidget })),
  { ssr: false }
);

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
        "min-h-screen font-sans antialiased transition-opacity duration-300 opacity-100 relative overflow-x-hidden",
        // Dynamic background with subtle grid and gradient mesh
        "bg-background selection:bg-primary/20"
      )}
      style={{
        ...themeStyle as React.CSSProperties,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 -z-10 h-full w-full bg-background">
        <div className="absolute h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>
        <div className="absolute right-0 bottom-0 -z-10 h-[310px] w-[310px] rounded-full bg-accent/20 opacity-20 blur-[100px]"></div>
      </div>

      <div className="relative z-0">
        {children}
      </div>

      {showNewsletterWidget && <NewsletterWidget position="bottom-left" showDelay={5000} />}
      <CookieConsent />
    </div>
  );
}
