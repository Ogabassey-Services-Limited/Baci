// Client chunk: the below-fold related-product rails (brand + price band).
// Split out of the deferred tabs chunk so the SSR semantic sections can sit
// ABOVE the rails in DOM order without forcing the rails into the main bundle.
// Loaded via a runtime import() inside OgabasseyPdpDeferredRailsIsland, so its
// JS/CSS stays off the critical path until the rails scroll into view.
'use client';

import { BrandProducts } from '@/components/storefront/brand-products';
import { PriceRangeProducts } from '@/components/storefront/price-range-products';
import type { Product } from '@/lib/products';

interface DeferredProductRailsProps {
  product: Product;
}

export function DeferredProductRails({ product }: DeferredProductRailsProps) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <BrandProducts
        product={product}
        maxProducts={4}
        className="border-t border-store-background-text/10 pt-8"
      />
      <PriceRangeProducts
        product={product}
        maxProducts={4}
        className="border-t border-store-background-text/10"
      />
    </div>
  );
}
