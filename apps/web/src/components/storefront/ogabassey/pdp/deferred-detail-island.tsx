import type { ReactNode } from 'react';
import type { Product } from '@/components/storefront/ogabassey/types';
import { OgabasseyPdpDeferredDetailClient } from './deferred-detail-island.client';

interface OgabasseyPdpDeferredDetailIslandProps {
  product: Product;
  semanticSections?: ReactNode;
}

export function OgabasseyPdpDeferredDetailIsland({
  product,
  semanticSections = null,
}: OgabasseyPdpDeferredDetailIslandProps) {
  return (
    <section aria-label="Product details" data-ogabassey-pdp-semantics>
      {semanticSections}
      <OgabasseyPdpDeferredDetailClient product={product} />
    </section>
  );
}
