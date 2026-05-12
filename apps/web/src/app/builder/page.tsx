import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CopilotBuilderWrapper } from '@/components/builder/copilot-builder-wrapper';
import { CsrfInitializer } from '@/components/csrf-initializer';
import { StorefrontProvider } from '@/contexts/storefront-context';
import { MerchantProvider } from '@/hooks/use-merchant-client';
import BuilderClient from './builder-client';

export const metadata: Metadata = {
  title: 'Your AI-Powered Builder - Baci',
  description: 'Customize your storefront',
};

function BuilderPageFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground"
      role="status"
    >
      Loading builder...
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<BuilderPageFallback />}>
      <MerchantProvider>
        <StorefrontProvider>
          <CsrfInitializer />
          <CopilotBuilderWrapper>
            <BuilderClient />
          </CopilotBuilderWrapper>
        </StorefrontProvider>
      </MerchantProvider>
    </Suspense>
  );
}
