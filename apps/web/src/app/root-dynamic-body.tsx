import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { WebVitalsReporter } from '@/components/analytics/web-vitals-reporter';
import { Toaster } from '@/components/ui/toaster';
import { NonceProvider } from '@/contexts/NonceProvider';
import { Providers } from '@/contexts/providers';

export async function RootDynamicBody({ children }: { children: ReactNode }) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') || undefined;

  // Detect storefront routes via middleware-set headers to prevent
  // next-themes from applying dashboard dark mode on merchant stores
  const isStorefront = !!(
    headersList.get('x-merchant-slug') || headersList.get('x-custom-domain')
  );

  return (
    <>
      <NonceProvider nonce={nonce}>
        <Providers forcedTheme={isStorefront ? 'light' : undefined}>
          {children}
          <Toaster />
        </Providers>
      </NonceProvider>
      <WebVitalsReporter />
      <Analytics />
      <SpeedInsights />
    </>
  );
}
