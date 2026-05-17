// Client chunk: receives interactive tab-change callback and renders client-only tabs/video sections.
'use client';

import dynamic from 'next/dynamic';
import type { Product as RelatedProduct } from '@/lib/products';
import { BrandProducts } from '@/components/storefront/brand-products';
import { PriceRangeProducts } from '@/components/storefront/price-range-products';
import { ProductVideo } from '../../components/ProductVideo';
import type { NormalizedProductDetails } from './product-details-helpers';
import { ProductDetailsTabs } from './product-details-tabs';
import type { ProductDetailsActiveTab } from './use-product-details-state';

const AdUnit = dynamic(
  () => import('../../components/AdUnit').then((mod) => mod.AdUnit),
  { loading: () => null, ssr: false }
);

interface DeferredProductDetailsSectionsProps {
  activeTab: ProductDetailsActiveTab;
  normalizedReviewRatingWidth: string;
  onSelectTab: (tab: ProductDetailsActiveTab) => void;
  productData: NormalizedProductDetails;
  relatedProductsProduct: RelatedProduct;
  storeSlug: string;
}

export function DeferredProductDetailsSections({
  activeTab,
  normalizedReviewRatingWidth,
  onSelectTab,
  productData,
  relatedProductsProduct,
  storeSlug,
}: DeferredProductDetailsSectionsProps) {
  return (
    <div className="[content-visibility:auto] [contain-intrinsic-size:1400px_2200px]">
      <div className="mb-12 mt-12">
        <AdUnit placementKey="CONTENT_BREAK" />
      </div>

      <ProductDetailsTabs
        activeTab={activeTab}
        normalizedReviewRatingWidth={normalizedReviewRatingWidth}
        onSelectTab={onSelectTab}
        productData={productData}
        storeSlug={storeSlug}
      />

      {productData.videoUrl ? (
        <ProductVideo videoId={productData.videoUrl} title={productData.name} />
      ) : null}

      <div className="mx-auto max-w-[1400px]">
        <BrandProducts
          product={relatedProductsProduct}
          maxProducts={4}
          className="border-t border-[color:color-mix(in_srgb,var(--store-background-text,#111827)_10%,transparent)] pt-8"
        />
        <PriceRangeProducts
          product={relatedProductsProduct}
          maxProducts={4}
          className="border-t border-[color:color-mix(in_srgb,var(--store-background-text,#111827)_10%,transparent)]"
        />
      </div>
    </div>
  );
}
