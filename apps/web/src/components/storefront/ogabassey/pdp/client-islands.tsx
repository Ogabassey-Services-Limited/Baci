'use client';

import type { ReactNode } from 'react';
import { ProductDetailsPage } from '@/components/storefront/ogabassey/pages/product-details-page';
import type { Product } from '@/components/storefront/ogabassey/types';

interface OgabasseyPdpCommerceIslandProps {
  product: Product;
}

interface OgabasseyPdpBelowFoldIslandProps {
  product: Product;
  semanticSections?: ReactNode;
}

export function OgabasseyPdpCommerceIsland({
  product,
}: OgabasseyPdpCommerceIslandProps) {
  return <ProductDetailsPage mode="commerce" product={product} />;
}

export function OgabasseyPdpBelowFoldIsland({
  product,
  semanticSections = null,
}: OgabasseyPdpBelowFoldIslandProps) {
  return (
    <ProductDetailsPage
      mode="belowFold"
      product={product}
      semanticSections={semanticSections}
    />
  );
}
