import type { Route } from 'next';
import type { Product as CartProduct } from '@/lib/products';
import {
  getOgabasseyPdpPriceSlotId,
  getOgabasseyPdpVariantSelectorSlotId,
  type OgabasseyPdpCriticalProduct,
} from './critical-product';
import { OgabasseyPdpCriticalCommerceClient } from './critical-commerce.client';

interface OgabasseyPdpCriticalCommerceProps {
  cartHref: Route;
  cartProduct: CartProduct;
  initialVariantSelection?: {
    attributes?: Record<string, string>;
    condition?: string;
    variantId?: string;
  };
  product: Pick<
    OgabasseyPdpCriticalProduct,
    | 'brand'
    | 'categoryName'
    | 'categorySlug'
    | 'condition'
    | 'id'
    | 'image'
    | 'name'
    | 'price'
    | 'slug'
    | 'stockQuantity'
  > & {
    variantCount?: number;
  };
  variantAxes?: string[];
}

function formatCondition(condition: string | null | undefined) {
  const normalizedCondition = condition?.trim();
  if (!normalizedCondition) {
    return null;
  }

  return normalizedCondition
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function OgabasseyPdpCriticalCommerce({
  cartHref,
  cartProduct,
  initialVariantSelection,
  product,
  variantAxes = [],
}: OgabasseyPdpCriticalCommerceProps) {
  const formattedCondition = formatCondition(product.condition);
  const variantSelectorPortalTargetId = getOgabasseyPdpVariantSelectorSlotId(
    product.id
  );
  const pricePortalTargetId = getOgabasseyPdpPriceSlotId(product.id);

  return (
    <aside
      data-ogabassey-pdp-commerce-panel
      aria-label="Purchase options"
    >
      <div data-ogabassey-pdp-commerce-facts>
        <p data-ogabassey-pdp-commerce-eyebrow>
          Ready to buy
        </p>
        {formattedCondition ? (
          <p data-ogabassey-pdp-commerce-fact>
            <span>Condition</span>
            <strong>{formattedCondition}</strong>
          </p>
        ) : null}
        <p data-ogabassey-pdp-commerce-fact>
          <span>Delivery</span>
          <strong>Lagos and nationwide</strong>
        </p>
      </div>
      <OgabasseyPdpCriticalCommerceClient
        cartHref={cartHref}
        cartProduct={cartProduct}
        initialVariantSelection={initialVariantSelection}
        pricePortalTargetId={pricePortalTargetId}
        productName={product.name}
        variantSelectorPortalTargetId={variantSelectorPortalTargetId}
        variantAxes={variantAxes}
        variantCount={product.variantCount || 0}
      />
    </aside>
  );
}
