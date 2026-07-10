// Client chunk: receives interactive tab-change callback and renders client-only tabs/video sections.
'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useEffect } from 'react';
import type { Product as RelatedProduct } from '@/lib/products';
import type { OgabasseyPdpDeferredTabProduct } from '@/components/storefront/ogabassey/pdp/deferred-product-payload';
import { ProductVideo } from '../../components/ProductVideo';
import { ProductDetailsTabs } from './product-details-tabs';
import type { ProductDetailsActiveTab } from './use-product-details-state';

const AdUnit = dynamic(
  () => import('../../components/AdUnit').then((mod) => mod.AdUnit),
  { loading: () => null, ssr: false }
);

const InlineProductRails = dynamic(
  () => import('./inline-product-rails').then((mod) => mod.InlineProductRails),
  { loading: () => null }
);

export interface DeferredProductDetailsSectionsProps {
  activeTab: ProductDetailsActiveTab;
  /**
   * Server-rendered product description slot (`<SafeHtml>`), threaded to
   * `ProductDetailsTabs` so `sanitize-html` stays in the server graph.
   */
  descriptionSlot?: ReactNode;
  normalizedReviewRatingWidth: string;
  onSelectTab: (tab: ProductDetailsActiveTab) => void;
  productData: OgabasseyPdpDeferredTabProduct;
  relatedProductsProduct?: RelatedProduct;
  storeSlug: string;
  /**
   * Render the related-product rails inline. Ogabassey passes `false` and
   * renders the rails via a separate deferred island so the SSR semantic
   * sections can sit above them; other templates keep the inline rails.
   */
  showRails?: boolean;
  onLoaded?: () => void;
}

export function DeferredProductDetailsSections({
  activeTab,
  descriptionSlot,
  normalizedReviewRatingWidth,
  onSelectTab,
  productData,
  relatedProductsProduct,
  storeSlug,
  showRails = true,
  onLoaded,
}: DeferredProductDetailsSectionsProps) {
  useEffect(() => {
    onLoaded?.();
  }, [onLoaded]);

  return (
    <div className="[content-visibility:auto] [contain-intrinsic-size:1400px_2200px]">
      <ProductDetailsTabs
        activeTab={activeTab}
        descriptionSlot={descriptionSlot}
        normalizedReviewRatingWidth={normalizedReviewRatingWidth}
        onSelectTab={onSelectTab}
        productData={productData}
        storeSlug={storeSlug}
      />

      <div className="mb-12 mt-12">
        <AdUnit placementKey="CONTENT_BREAK" />
      </div>

      {productData.videoUrl ? (
        <ProductVideo videoId={productData.videoUrl} title={productData.name} />
      ) : null}

      {showRails && relatedProductsProduct ? (
        <InlineProductRails relatedProductsProduct={relatedProductsProduct} />
      ) : null}
    </div>
  );
}
