import type { Route } from 'next';
import { Suspense } from 'react';
import {
  type OgabasseyPdpCriticalProduct,
} from './critical-product';
import { OgabasseyPdpCriticalCommerceControls } from './critical-commerce.client';

interface OgabasseyPdpCriticalCommerceProps {
  cartBasePathPromise?: Promise<string>;
  cartHref?: Route;
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
}

async function OgabasseyPdpResolvedCriticalCommerceControls({
  basePathPromise,
  productName,
}: {
  basePathPromise: Promise<string>;
  productName: string;
}) {
  const basePath = await basePathPromise;
  const cartHref = `${basePath}/cart` as Route;

  return (
    <OgabasseyPdpCriticalCommerceControls
      cartHref={cartHref}
      productName={productName}
    />
  );
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
  cartBasePathPromise,
  cartHref,
  product,
}: OgabasseyPdpCriticalCommerceProps) {
  const formattedCondition = formatCondition(product.condition);
  const controls = cartHref ? (
    <OgabasseyPdpCriticalCommerceControls
      cartHref={cartHref}
      productName={product.name}
    />
  ) : cartBasePathPromise ? (
    <Suspense fallback={null}>
      <OgabasseyPdpResolvedCriticalCommerceControls
        basePathPromise={cartBasePathPromise}
        productName={product.name}
      />
    </Suspense>
  ) : null;

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
      {controls}
    </aside>
  );
}
