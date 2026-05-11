import type { ReactNode } from 'react';
import { DeferredPlatformInsights } from '@/components/analytics/deferred-platform-insights';
import { WebVitalsReporter } from '@/components/analytics/web-vitals-reporter';
import { Toaster } from '@/components/ui/toaster';
import { NonceProvider } from '@/contexts/NonceProvider';

export function RootDynamicBody({
  children,
  nonce,
}: {
  children: ReactNode;
  nonce?: string;
}) {
  return (
    <>
      <NonceProvider nonce={nonce}>
        {children}
        <Toaster />
      </NonceProvider>
      <WebVitalsReporter />
      <DeferredPlatformInsights />
    </>
  );
}
