import { MerchantProvider } from '@/hooks/use-merchant';
import React from 'react';
import ProductDetailClient from './product-detail-client';

// This is the main page component, which is a Server Component.
// Its only job is to get the ID from the URL and render the client component.
export default async function ProductPage({ params }: { params: { id: string } }) {
  const { id } = params;

  return (
    <MerchantProvider>
      <ProductDetailClient productId={id} />
    </MerchantProvider>
  );
}
