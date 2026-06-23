// Client chunk: inline related-product rails for non-OgaBassey PDP templates.
'use client';

import { BrandProducts } from '@/components/storefront/brand-products';
import { PriceRangeProducts } from '@/components/storefront/price-range-products';
import type { Product as RelatedProduct } from '@/lib/products';

interface InlineProductRailsProps {
  relatedProductsProduct: RelatedProduct;
}

export function InlineProductRails({
  relatedProductsProduct,
}: InlineProductRailsProps) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <BrandProducts
        product={relatedProductsProduct}
        maxProducts={4}
        className="border-t border-store-background-text/10 pt-8"
      />
      <PriceRangeProducts
        product={relatedProductsProduct}
        maxProducts={4}
        className="border-t border-store-background-text/10"
      />
    </div>
  );
}
