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

  return (
    normalizedCondition.charAt(0).toUpperCase() + normalizedCondition.slice(1)
  );
}

export function OgabasseyPdpCriticalCommerce({
  cartHref,
  cartProduct,
  product,
}: OgabasseyPdpCriticalCommerceProps) {
  const formattedCondition = formatCondition(product.condition);

  return (
    <aside className={styles.panel} aria-label="Purchase options">
      <div className={styles.facts}>
        <p className={styles.eyebrow}>Ready to buy</p>
        {formattedCondition ? (
          <p className={styles.fact}>
            <span>Condition</span>
            <strong>{formattedCondition}</strong>
          </p>
        ) : null}
        <p className={styles.fact}>
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
