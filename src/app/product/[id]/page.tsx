import { MerchantProvider } from '@/hooks/use-merchant';
import React from 'react';
import ProductDetailClient from './product-detail-client';

// This is the main page component, which is a Server Component.
// Its only job is to get the ID from the URL and render the client component.
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  // In Next.js 15, params is a Promise and must be awaited
  const { id } = await params;

  return (
    <MerchantProvider>
      <ProductDetailClient productId={id} />
    </MerchantProvider>
  );
}
