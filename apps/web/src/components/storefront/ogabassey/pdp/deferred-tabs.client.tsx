'use client';

import '@/app/(storefront)/storefront-ogabassey-pdp-deferred.css';
import { type ReactNode, useState } from 'react';
import { DeferredProductDetailsSections } from '@/components/storefront/ogabassey/pages/product-details-page/deferred-product-details-sections';
import type { ProductDetailsActiveTab } from '@/components/storefront/ogabassey/pages/product-details-page/use-product-details-state';
import type { OgabasseyPdpDeferredTabProduct } from './deferred-product-payload';

interface OgabasseyPdpDeferredTabsClientProps {
  descriptionSlot?: ReactNode;
  productData: OgabasseyPdpDeferredTabProduct;
  storeSlug: string;
}

export function OgabasseyPdpDeferredTabsClient({
  descriptionSlot,
  productData,
  storeSlug,
}: OgabasseyPdpDeferredTabsClientProps) {
  const [activeTab, setActiveTab] =
    useState<ProductDetailsActiveTab>('description');
  const normalizedReviewRating = Math.max(
    0,
    Math.min(Number(productData.rating) || 0, 5)
  );
  const normalizedReviewRatingWidth = `${(normalizedReviewRating / 5) * 100}%`;
  const normalizedProductData = {
    ...productData,
    rating: normalizedReviewRating,
  };

  return (
    <div className="ogabassey-pdp-deferred-tabs-container">
      <DeferredProductDetailsSections
        activeTab={activeTab}
        descriptionSlot={descriptionSlot}
        normalizedReviewRatingWidth={normalizedReviewRatingWidth}
        onSelectTab={setActiveTab}
        productData={normalizedProductData}
        showRails={false}
        storeSlug={storeSlug}
      />
    </div>
  );
}
