import type { ReactNode } from 'react';
import type { Product } from '@/components/storefront/ogabassey/types';
import { OgabasseyPdpDeferredDetailIsland } from './deferred-detail-island';

interface OgabasseyPdpBelowFoldIslandProps {
  product: Product;
  semanticSections?: ReactNode;
  serverPrimaryDetails?: ReactNode;
  storeSlug: string;
}

export function OgabasseyPdpBelowFoldIsland({
  product,
  semanticSections = null,
  serverPrimaryDetails = null,
  storeSlug,
}: OgabasseyPdpBelowFoldIslandProps) {
  return (
    <OgabasseyPdpDeferredDetailIsland
      product={product}
      semanticSections={semanticSections}
      serverPrimaryDetails={serverPrimaryDetails}
      storeSlug={storeSlug}
    />
  );
}
