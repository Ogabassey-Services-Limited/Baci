'use server';

import { MerchantProvider } from '@/hooks/use-merchant';
import { RepairsClient } from './repairs-client';

export default async function RepairsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <MerchantProvider slug={slug}>
      <RepairsClient slug={slug} />
    </MerchantProvider>
  );
}
