'use client';

import dynamic from 'next/dynamic';
import type { MerchantData } from '@/hooks/use-merchant';
import {
  getContrastingTextColor,
  hexToHslComponents,
  hexToRgba,
} from '@/lib/color-utils';
import { cn } from '@/lib/utils';

const STORE_BORDER_ALPHA = 0.24;

// Dynamically import non-critical components to reduce initial bundle size
// These components appear after user interaction or with delay
const CookieConsent = dynamic(
  () =>
    import('@/components/storefront/cookie-consent').then(
      (mod) => mod.CookieConsent
    ),
  { ssr: false }
);

const NewsletterWidget = dynamic(
  () =>
    import('@/components/storefront/newsletter-widget').then(
      (mod) => mod.NewsletterWidget
    ),
  { ssr: false }
);

// Platform analytics - dynamically imported for non-blocking initial render
const PlatformAnalyticsProvider = dynamic(
  () =>
    import('@/components/analytics/platform-analytics-provider').then(
      (mod) => mod.PlatformAnalyticsProvider
    ),
  { ssr: false }
);

export default function AppBody({
  children,
  merchant,
  showNewsletterWidget = true,
  showCookieConsent = true,
  showPlatformAnalytics = false,
  applyMerchantCoreThemeVariables = true,
}: {
  children: React.ReactNode;
  merchant?: MerchantData | null;
  showNewsletterWidget?: boolean;
  showCookieConsent?: boolean;
  showPlatformAnalytics?: boolean;
  /**
   * Storefront pages can opt in to overriding core shadcn variables
   * to prevent background flashes before merchant branding hydrates.
   * Dashboard should keep this disabled so dark mode can control core tokens.
   */
  applyMerchantCoreThemeVariables?: boolean;
}) {
  const primaryTextColor = merchant?.brand_colors
    ? getContrastingTextColor(merchant.brand_colors.primary)
    : undefined;
  // Define CSS variables for the merchant's theme
  const themeStyle = merchant?.brand_colors
    ? {
        ...(applyMerchantCoreThemeVariables
          ? {
              // Storefront-only: lock core tokens to merchant background
              // to prevent an initial dashboard-theme flash during hydration.
              '--background': hexToHslComponents(
                merchant.brand_colors.background
              ),
              '--foreground': hexToHslComponents(
                getContrastingTextColor(merchant.brand_colors.background)
              ),
              '--card': hexToHslComponents(merchant.brand_colors.background),
              '--card-foreground': hexToHslComponents(
                getContrastingTextColor(merchant.brand_colors.background)
              ),
            }
          : {}),
        '--primary': hexToHslComponents(merchant.brand_colors.primary),
        '--primary-foreground': hexToHslComponents(
          getContrastingTextColor(merchant.brand_colors.primary)
        ),
        '--accent': hexToHslComponents(merchant.brand_colors.accent),
        '--accent-foreground': hexToHslComponents(
          getContrastingTextColor(merchant.brand_colors.accent)
        ),
        '--ring': hexToHslComponents(merchant.brand_colors.primary),

        // Legacy/Custom Baci variables
        '--store-primary': merchant.brand_colors.primary,
        '--store-background': merchant.brand_colors.background,
        '--store-accent': merchant.brand_colors.accent,
        '--store-primary-text': primaryTextColor,
        '--store-on-primary': primaryTextColor,
        '--store-border': hexToRgba(
          merchant.brand_colors.primary,
          STORE_BORDER_ALPHA
        ),
        '--store-background-text': getContrastingTextColor(
          merchant.brand_colors.background
        ),
        '--store-accent-text': getContrastingTextColor(
          merchant.brand_colors.accent
        ),
      }
    : {};

  return (
    <div
      className={cn(
        'min-h-screen font-sans antialiased transition-opacity duration-300 opacity-100 relative overflow-x-hidden',
        // Dynamic background with subtle grid and gradient mesh
        'bg-background selection:bg-primary/20'
      )}
      style={{
        ...(themeStyle as React.CSSProperties),
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Dynamic Background Elements - GPU accelerated with will-change */}
      <div className="fixed inset-0 -z-10 h-full w-full bg-background">
        <div className="absolute h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[14px_24px]" />
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px] will-change-transform" />
        <div className="absolute right-0 bottom-0 -z-10 h-[310px] w-[310px] rounded-full bg-accent/20 opacity-20 blur-[100px] will-change-transform" />
      </div>

      {showPlatformAnalytics && <PlatformAnalyticsProvider />}

      <div className="relative z-0">{children}</div>

      {showNewsletterWidget && (
        <NewsletterWidget position="bottom-left" showDelay={5000} />
      )}
      {showCookieConsent && <CookieConsent />}
    </div>
  );
}
