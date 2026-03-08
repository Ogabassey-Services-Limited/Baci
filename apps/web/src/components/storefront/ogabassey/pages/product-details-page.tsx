'use client';

import { NegotiationModal } from '../components/NegotiationModal';
import { ProductVideo } from '../components/ProductVideo';
import { AdUnit } from '../components/AdUnit';
import { BannerCarousel } from '../components/BannerCarousel';
import { BlogSnippet } from '../components/BlogSnippet';
import { FlyToCartAnimation } from '../components/FlyToCartAnimation';
import { BrandProducts } from '@/components/storefront/brand-products';
import { PriceRangeProducts } from '@/components/storefront/price-range-products';
import type { Product } from '../types';
import { ProductBreadcrumbs } from './product-details-page/product-breadcrumbs';
import { ProductDetailsTabs } from './product-details-page/product-details-tabs';
import { ProductMediaGallery } from './product-details-page/product-media-gallery';
import { ProductMobileActionBar } from './product-details-page/product-mobile-action-bar';
import { ProductPurchasePanel } from './product-details-page/product-purchase-panel';
import { SelectionRequiredModal } from './product-details-page/selection-required-modal';
import { useProductDetailsState } from './product-details-page/use-product-details-state';

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
    setSelectedColor,
    setSelectedCondition,
    setSelectedImage,
    showColorToast,
    validateAndAddToCart,
  } = useProductDetailsState(product);

  const handleAttributeSelection = (axis: string, value: string) => {
    setSelectedAttributes((prev) => ({ ...prev, [axis]: value }));
  };

  const handleModalColorSelection = (index: number) => {
    setSelectedColor(index);
    setSelectedImage(index);
    setMissingFields((prev) => prev.filter((field) => field !== 'Color'));
  };

  const handleModalAttributeSelection = (axis: string, value: string) => {
    const label = formatAxisLabel(axis);
    setSelectedAttributes((prev) => ({ ...prev, [axis]: value }));
    setMissingFields((prev) => prev.filter((field) => field !== label));
  };

  return (
    <div className="relative bg-white pb-32 pt-4">
      <div
        data-testid="product-banner-carousel"
        role="region"
        aria-label="Product banner carousel"
        className="mx-auto mb-8 hidden max-w-[1400px] px-4 md:block md:px-6"
      >
        <BannerCarousel className="h-40 md:h-52" />
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

          <div className="hidden lg:col-span-3 lg:block lg:border-l lg:border-gray-100 lg:pl-8">
            <div className="sticky top-24">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">
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
            <ProductVideo videoId={productData.videoUrl} title={productData.name} />
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
              className="border-t border-gray-100 pt-8"
            />
            <PriceRangeProducts
              product={relatedProductsProduct}
              maxProducts={4}
              className="border-t border-gray-100"
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
          imageSrc={productData.images[0]}
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
        currentPrice={productData.rawPrice || 0}
        type="single"
        onSuccess={handleNegotiationSuccess}
      />
    </div>
  );
}
