import type { Route } from 'next';
import type { Product as CartProduct } from '@/lib/products';
import type { OgabasseyPdpCriticalProduct } from './critical-product';
import { OgabasseyPdpCriticalCommerceClient } from './critical-commerce.client';
import styles from './critical-commerce.module.css';

interface OgabasseyPdpCriticalCommerceProps {
  cartHref: Route;
  cartProduct: CartProduct;
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
  product,
}: OgabasseyPdpCriticalCommerceProps) {
  const formattedCondition = formatCondition(product.condition);

  return (
    <aside
      className={styles.panel}
      data-ogabassey-pdp-commerce-panel
      aria-label="Purchase options"
    >
      <div className={styles.facts} data-ogabassey-pdp-commerce-facts>
        <p
          className={styles.eyebrow}
          data-ogabassey-pdp-commerce-eyebrow
        >
          Ready to buy
        </p>
        {formattedCondition ? (
          <p className={styles.fact} data-ogabassey-pdp-commerce-fact>
            <span>Condition</span>
            <strong>{formattedCondition}</strong>
          </p>
        ) : null}
        <p className={styles.fact} data-ogabassey-pdp-commerce-fact>
          <span>Delivery</span>
          <strong>Lagos and nationwide</strong>
        </p>
      </div>
      <OgabasseyPdpCriticalCommerceClient
        cartHref={cartHref}
        cartProduct={cartProduct}
        productName={product.name}
        variantCount={product.variantCount || 0}
      />
    </aside>
  );
}
