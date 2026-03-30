import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { ReactNode } from 'react';
import { WebVitalsReporter } from '@/components/analytics/web-vitals-reporter';
import { Toaster } from '@/components/ui/toaster';
import { NonceProvider } from '@/contexts/NonceProvider';
import { Providers } from '@/contexts/providers';

export function RootDynamicBody({ children }: { children: ReactNode }) {
  return (
    <>
      <NonceProvider>
        <Providers>
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
