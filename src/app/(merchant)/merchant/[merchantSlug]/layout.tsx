'use client';

import { MerchantProvider } from '@/hooks/use-merchant';
import { use } from 'react';

interface MerchantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ merchantSlug: string }>;
}

export default function MerchantLayout({ children, params }: MerchantLayoutProps) {
  const { merchantSlug } = use(params);

  return (
    <MerchantProvider slug={merchantSlug}>
      {children}
    </MerchantProvider>
  );
}
