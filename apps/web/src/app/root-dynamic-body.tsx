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

  return (
    <div
      id="root-dynamic-wrapper"
      className="contents"
      suppressHydrationWarning
    >
      <NonceProvider nonce={nonce}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </NonceProvider>
      <WebVitalsReporter />
      <Analytics />
      <SpeedInsights />
    </div>
  );
}
