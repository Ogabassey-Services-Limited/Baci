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

function formatCondition(condition: string) {
  return condition.charAt(0).toUpperCase() + condition.slice(1);
}

export function OgabasseyPdpCriticalCommerce({
  cartHref,
  cartProduct,
  product,
}: OgabasseyPdpCriticalCommerceProps) {
  return (
    <aside className={styles.panel} aria-label="Purchase options">
      <div className={styles.facts}>
        <p className={styles.eyebrow}>Ready to buy</p>
        <p className={styles.fact}>
          <span>Condition</span>
          <strong>{formatCondition(product.condition)}</strong>
        </p>
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
