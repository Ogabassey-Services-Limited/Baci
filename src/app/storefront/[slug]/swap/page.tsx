'use server';

import { MerchantProvider } from '@/hooks/use-merchant';
import { SwapClient } from './swap-client';

export default async function SwapPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <MerchantProvider slug={slug}>
      <SwapClient slug={slug} />
    </MerchantProvider>
  );
}
