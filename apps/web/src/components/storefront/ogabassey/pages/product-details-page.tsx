'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { Product } from '../types';
import { FlyToCartAnimation } from '../components/FlyToCartAnimation';
import { NegotiationModal } from '../components/NegotiationModal';
import { ProductBreadcrumbs } from './product-details-page/product-breadcrumbs';
import { ProductMediaGallery } from './product-details-page/product-media-gallery';
import { ProductMobileActionBar } from './product-details-page/product-mobile-action-bar';
import { ProductPurchasePanel } from './product-details-page/product-purchase-panel';
import { SelectionRequiredModal } from './product-details-page/selection-required-modal';
import { getAvailableOptionsForAxis } from '../variant-attributes';
import { useProductDetailsState } from './product-details-page/use-product-details-state';

const AdUnit = dynamic(
  () => import('../components/AdUnit').then((mod) => mod.AdUnit),
  { loading: () => null, ssr: false }
);
const BannerCarousel = dynamic(
  () =>
    import('../components/BannerCarousel').then((mod) => mod.BannerCarousel),
  { loading: () => null, ssr: false }
);
const BlogSnippet = dynamic(
  () => import('../components/BlogSnippet').then((mod) => mod.BlogSnippet),
  { loading: () => null }
);
const BrandProducts = dynamic(
  () =>
    import('@/components/storefront/brand-products').then(
      (mod) => mod.BrandProducts
    ),
  { loading: () => null }
);
const PriceRangeProducts = dynamic(
  () =>
    import('@/components/storefront/price-range-products').then(
      (mod) => mod.PriceRangeProducts
    ),
  { loading: () => null }
);
const ProductDetailsTabs = dynamic(
  () =>
    import('./product-details-page/product-details-tabs').then(
      (mod) => mod.ProductDetailsTabs
    ),
  { loading: () => null }
);
const ProductVideo = dynamic(
  () => import('../components/ProductVideo').then((mod) => mod.ProductVideo),
  { loading: () => null }
);

interface ProductDetailsPageProps {
  product: Product;
}

export function ProductDetailsPage({ product }: ProductDetailsPageProps) {
  const {
    activeTab,
    animatingParticles,
    basePath,
    cartHref,
    currentOffer,
    deliveryEstimate,
    deliveryLocation,
    effectiveAxes,
    formatAxisLabel,
    getAxisOptions,
    handleAnimationComplete,
    handleColorDoubleClick,
    handleColorSelection,
    handleDecrement,
    handleIncrement,
    handleKeyDown,
    handleMobileAddToCart,
    handleNegotiationSuccess,
    handleQuantityBlur,
    handleQuantityChange,
    handleShare,
    handleToggleSaved,
    homeHref,
    inputValue,
    isLiked,
    isNegotiationOpen,
    isSelectionModalOpen,
    merchantId,
    merchantSlug,
    missingFields,
    normalizedReviewRatingWidth,
    productData,
    quantityInCart,
    relatedProductsProduct,
    secondaryColor,
    selectedAttributes,
    selectedColor,
    selectedCondition,
    selectedImage,
    setActiveTab,
    setDeliveryLocation,
    setIsNegotiationOpen,
    setIsSelectionModalOpen,
    setMissingFields,
    setSelectedAttributes,
    setSelectedCondition,
    setSelectedImage,
    showColorToast,
    validateAndAddToCart,
  } = useProductDetailsState(product);

  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const syncViewport = () => {
      setIsDesktop(mediaQuery.matches);
    };

    syncViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport);
      return () => {
        mediaQuery.removeEventListener('change', syncViewport);
      };
    }

    mediaQuery.addListener(syncViewport);
    return () => {
      mediaQuery.removeListener(syncViewport);
    };
  }, []);

  const handleAttributeSelection = (axis: string, value: string) => {
    const hasVariants =
      Array.isArray(productData.variants) && productData.variants.length > 0;
    setSelectedAttributes((prev) => {
      const next = { ...prev, [axis]: value };
      // When no variant rows exist, preserve all sibling selections
      if (!hasVariants) return next;
      // Drop sibling selections that are no longer reachable with the new choice
      return Object.fromEntries(
        Object.entries(next).filter(([key, selectedValue]) => {
          if (key === axis) return true;
          const reachable = getAvailableOptionsForAxis(
            key,
            productData.variants,
            Object.fromEntries(Object.entries(next).filter(([k]) => k !== key)),
          );
          return reachable.includes(selectedValue);
        }),
      );
    });
  };

  const handleModalColorSelection = (index: number) => {
    handleColorSelection(index);
    setMissingFields((prev) => prev.filter((field) => field !== 'Color'));
  };

  const handleModalAttributeSelection = (axis: string, value: string) => {
    const label = formatAxisLabel(axis);
    setSelectedAttributes((prev) => ({ ...prev, [axis]: value }));
    setMissingFields((prev) => prev.filter((field) => field !== label));
  };

  return (
    <div className="relative bg-[var(--store-background,#ffffff)] pb-32 pt-4">
      <div
        data-testid="product-banner-carousel"
        role="region"
        aria-label="Product banner carousel"
        className="mx-auto mb-8 hidden min-h-[208px] max-w-[1400px] px-4 md:block md:px-6"
      >
        {isDesktop ? <BannerCarousel className="h-40 md:h-52" /> : null}
      </div>

      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <ProductBreadcrumbs
          basePath={basePath}
          homeHref={homeHref}
          productData={productData}
        />

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          <ProductMediaGallery
            onSelectImage={setSelectedImage}
            productData={productData}
            selectedCondition={selectedCondition}
            selectedImage={selectedImage}
          />

          <ProductPurchasePanel
            cartHref={cartHref}
            currentOfferPrice={currentOffer.price}
            deliveryEstimate={deliveryEstimate}
            deliveryLocation={deliveryLocation}
            effectiveAxes={effectiveAxes}
            formatAxisLabel={formatAxisLabel}
            getAxisOptions={getAxisOptions}
            inputValue={inputValue}
            isLiked={isLiked}
            onAddToCart={validateAndAddToCart}
            onChangeAttribute={handleAttributeSelection}
            onChangeDeliveryLocation={setDeliveryLocation}
            onDecrement={handleDecrement}
            onIncrement={handleIncrement}
            onInputBlur={handleQuantityBlur}
            onInputChange={handleQuantityChange}
            onInputKeyDown={handleKeyDown}
            onSelectColor={handleColorSelection}
            onSelectSecondaryColor={handleColorDoubleClick}
            onSetCondition={setSelectedCondition}
            onShare={handleShare}
            onToggleSaved={handleToggleSaved}
            productData={productData}
            quantityInCart={quantityInCart}
            secondaryColor={secondaryColor}
            selectedAttributes={selectedAttributes}
            selectedColor={selectedColor}
            selectedCondition={selectedCondition}
            showColorToast={showColorToast}
          />

          <div className="hidden lg:col-span-3 lg:block lg:border-l lg:border-[color:color-mix(in_srgb,var(--store-background-text,#111827)_10%,transparent)] lg:pl-8">
            <div className="sticky top-24">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[color:color-mix(in_srgb,var(--store-background-text,#111827)_50%,transparent)]">
                Sponsored
              </p>
              <AdUnit placementKey="SIDEBAR_HALF_PAGE" className="mb-6" />
            </div>
          </div>
        </div>

        <div className="[content-visibility:auto] [contain-intrinsic-size:1400px_2200px]">
          <div className="mb-12 mt-12">
            <AdUnit placementKey="CONTENT_BREAK" />
          </div>

          <ProductDetailsTabs
            activeTab={activeTab}
            normalizedReviewRatingWidth={normalizedReviewRatingWidth}
            onSelectTab={setActiveTab}
            productData={productData}
            storeSlug={merchantSlug}
          />

          {productData.videoUrl && (
            <ProductVideo
              videoId={productData.videoUrl}
              title={productData.name}
            />
          )}

          <BlogSnippet
            category={productData.categories?.name || productData.category || 'General'}
            productId={String(productData.id)}
            merchantId={merchantId}
          />

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
      </div>

      <ProductMobileActionBar
        cartHref={cartHref}
        onDecrement={handleDecrement}
        onIncrement={handleIncrement}
        onMobileAddToCart={handleMobileAddToCart}
        quantityInCart={quantityInCart}
      />

      {animatingParticles.map((rect, index) => (
        <FlyToCartAnimation
          key={`${rect.x}-${rect.y}-${index}`}
          startRect={rect}
          onComplete={handleAnimationComplete}
          imageSrc={productData.images[selectedImage] ?? productData.images[0]}
        />
      ))}

      <SelectionRequiredModal
        effectiveAxes={effectiveAxes}
        formatAxisLabel={formatAxisLabel}
        getAxisOptions={getAxisOptions}
        isOpen={isSelectionModalOpen}
        missingFields={missingFields}
        onClose={() => setIsSelectionModalOpen(false)}
        onConfirm={() => {
          if (missingFields.length === 0) {
            setIsSelectionModalOpen(false);
            validateAndAddToCart();
          }
        }}
        onSelectAttribute={handleModalAttributeSelection}
        onSelectColor={handleModalColorSelection}
        productData={productData}
        selectedAttributes={selectedAttributes}
        selectedColor={selectedColor}
      />

      <NegotiationModal
        isOpen={isNegotiationOpen}
        onClose={() => setIsNegotiationOpen(false)}
        productName={productData.name}
        currentPrice={currentOffer.rawPrice}
        onSuccess={handleNegotiationSuccess}
        type="single"
        itemId={String(productData.id)}
        merchantId={merchantId || ''}
      />
    </div>
  );
}
