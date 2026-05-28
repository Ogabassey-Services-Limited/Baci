import type { ReactNode } from 'react';
import type { Product } from '@/components/storefront/ogabassey/types';
import { OgabasseyPdpDeferredDetailIsland } from './deferred-detail-island';

interface OgabasseyPdpBelowFoldIslandProps {
  product: Product;
  semanticSections?: ReactNode;
}

export function OgabasseyPdpBelowFoldIsland({
  product,
  semanticSections = null,
}: OgabasseyPdpBelowFoldIslandProps) {
  return (
    <OgabasseyPdpDeferredDetailIsland
      product={product}
      semanticSections={semanticSections}
    />
  );
}
