'use client';

import { use } from 'react';
import { MerchantProvider } from '@/hooks/use-merchant-client';

interface MerchantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ merchantSlug: string }>;
}

export default function MerchantLayout({
  children,
  params,
}: MerchantLayoutProps) {
  const { merchantSlug } = use(params);

  return <MerchantProvider slug={merchantSlug}>{children}</MerchantProvider>;
}
