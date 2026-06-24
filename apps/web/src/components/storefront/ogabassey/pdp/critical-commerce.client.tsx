'use client';

import Link from 'next/link';
import type { Route } from 'next';
import type { Product as CartProduct } from '@/lib/products';
import {
  formatCriticalPrice,
  type InitialCriticalVariantSelection,
} from './critical-commerce-selection';
import {
  OgabasseyPdpCriticalCommerceProvider,
  useOgabasseyPdpCriticalCommerce,
} from './critical-commerce-state.client';
import { OgabasseyPdpCriticalVariantSelectors } from './critical-variant-selectors.client';

export { OgabasseyPdpCriticalCommerceProvider } from './critical-commerce-state.client';

interface OgabasseyPdpCriticalCommerceClientProps {
  cartHref: Route;
  cartProduct: CartProduct;
  initialVariantSelection?: InitialCriticalVariantSelection;
  productName: string;
  variantAxes?: string[];
  variantCount: number;
}

interface OgabasseyPdpCriticalCommerceControlsProps {
  cartHref: Route;
  productName: string;
}

export function OgabasseyPdpCriticalCommerceSummary() {
  const {
    explicitSelectedAxes,
    handleAttributeSelection,
    productForCart,
    renderableVariantAxes,
    selectedAttributes,
    variantCount,
    variants,
  } = useOgabasseyPdpCriticalCommerce();

  return (
    <>
      <div data-ogabassey-pdp-price>
        <span data-ogabassey-pdp-price-live>
          {formatCriticalPrice(productForCart.price)}
        </span>
      </div>
      <div data-ogabassey-pdp-summary-variant-slot>
        <OgabasseyPdpCriticalVariantSelectors
          explicitSelectedAxes={explicitSelectedAxes}
          onAttributeSelection={handleAttributeSelection}
          renderableVariantAxes={renderableVariantAxes}
          selectedAttributes={selectedAttributes}
          variantCount={variantCount}
          variants={variants}
        />
      </div>
    </>
  );
}

export function OgabasseyPdpCriticalCommerceControls({
  cartHref,
  productName,
}: OgabasseyPdpCriticalCommerceControlsProps) {
  const {
    canAddToCart,
    handleAddToCart,
    isAtMaxQuantity,
    maxQuantity,
    quantity,
    setQuantity,
  } = useOgabasseyPdpCriticalCommerce();

  return (
    <div
      data-ogabassey-pdp-commerce-controls
      aria-label="Purchase controls"
      role="group"
    >
      <div
        data-ogabassey-pdp-commerce-quantity
        aria-label="Quantity"
      >
        <button
          aria-label={`Decrease quantity for ${productName}`}
          disabled={quantity <= 1}
          onClick={() => setQuantity((current) => Math.max(1, current - 1))}
          type="button"
        >
          -
        </button>
        <output aria-live="polite">{quantity}</output>
        <button
          aria-label={`Increase quantity for ${productName}`}
          disabled={isAtMaxQuantity}
          onClick={() =>
            setQuantity((current) =>
              maxQuantity === null
                ? current + 1
                : Math.min(maxQuantity, current + 1)
            )
          }
          type="button"
        >
          +
        </button>
      </div>
      <button
        data-ogabassey-pdp-commerce-primary-action
        disabled={!canAddToCart}
        onClick={handleAddToCart}
        type="button"
      >
        Add to cart
      </button>
      <Link
        data-ogabassey-pdp-commerce-secondary-action
        href={cartHref}
      >
        View cart
      </Link>
    </div>
  );
}

export function OgabasseyPdpCriticalCommerceClient({
  cartHref,
  cartProduct,
  initialVariantSelection,
  productName,
  variantAxes = [],
  variantCount,
}: OgabasseyPdpCriticalCommerceClientProps) {
  return (
    <OgabasseyPdpCriticalCommerceProvider
      cartProduct={cartProduct}
      initialVariantSelection={initialVariantSelection}
      variantAxes={variantAxes}
      variantCount={variantCount}
    >
      <OgabasseyPdpCriticalCommerceSummary />
      <OgabasseyPdpCriticalCommerceControls
        cartHref={cartHref}
        productName={productName}
      />
    </OgabasseyPdpCriticalCommerceProvider>
  );
}
