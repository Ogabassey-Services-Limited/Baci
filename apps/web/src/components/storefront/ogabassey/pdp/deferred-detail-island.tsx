import type { ReactNode } from 'react';
import type { Product } from '@/components/storefront/ogabassey/types';
import { OgabasseyPdpDeferredDetailClient } from './deferred-detail-island.client';
import { OgabasseyPdpDeferredRailsIsland } from './deferred-rails-island.client';

interface OgabasseyPdpDeferredDetailIslandProps {
  product: Product;
  semanticSections?: ReactNode;
}

export function OgabasseyPdpDeferredDetailIsland({
  product,
  semanticSections = null,
}: OgabasseyPdpDeferredDetailIslandProps) {
  return (
    <section
      aria-label="Product details"
      className="ogabassey-pdp-details-region"
      data-ogabassey-pdp-semantics
    >
      {/* Deferred client island #1: tabs / ad / video (rails excluded). */}
      <OgabasseyPdpDeferredDetailClient product={product} />
      {/*
        Server-render the semantic SEO sections (compare / price-band / guide
        internal links, trust bullets) in the static HTML, placed BETWEEN the
        tabs island and the rails island. Threading them through a client island
        instead would emit them only in the RSC payload (not crawlable by non-JS
        bots, at-risk for Googlebot). Keeping them SSR'd here keeps them
        crawlable AND lets "Buyer guides" sit above "More <brand> <category>".
      */}
      {semanticSections}
      {/* Deferred client island #2: related-product rails, loaded on scroll. */}
      <OgabasseyPdpDeferredRailsIsland product={product} />
    </section>
  );
}
