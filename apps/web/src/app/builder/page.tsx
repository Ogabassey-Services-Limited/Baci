import type { Metadata } from 'next';
import { CopilotBuilderWrapper } from '@/components/builder/copilot-builder-wrapper';
import { StorefrontProvider } from '@/contexts/storefront-context';
import { MerchantProvider } from '@/hooks/use-merchant';
import BuilderClient from './builder-client';

export const metadata: Metadata = {
  title: 'Your AI-Powered Builder - Baci',
  description: 'Customize your storefront',
};

export default function BuilderPage() {
  return (
    <MerchantProvider>
      <StorefrontProvider>
        <CopilotBuilderWrapper>
          <BuilderClient />
        </CopilotBuilderWrapper>
      </StorefrontProvider>
    </MerchantProvider>
  );
}
