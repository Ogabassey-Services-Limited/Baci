'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import { useCart } from '@/hooks/cart';
import type { Product as CartProduct } from '@/lib/products';
import styles from './critical-commerce.module.css';

interface OgabasseyPdpCriticalCommerceClientProps {
  cartHref: Route;
  cartProduct: CartProduct;
  productName: string;
  variantCount: number;
}

export function OgabasseyPdpCriticalCommerceClient({
  cartHref,
  cartProduct,
  productName,
  variantCount,
}: OgabasseyPdpCriticalCommerceClientProps) {
  const [quantity, setQuantity] = useState(1);
  const { addToCart, setIsCartOpen } = useCart();
  const maxQuantity =
    cartProduct.manage_stock &&
    typeof cartProduct.stock === 'number' &&
    cartProduct.stock > 0
      ? cartProduct.stock
      : null;
  const isAtMaxQuantity = maxQuantity !== null && quantity >= maxQuantity;

  function handleAddToCart() {
    const options = cartProduct.condition
      ? { condition: cartProduct.condition }
      : undefined;

    addToCart(cartProduct, quantity, options);
    setIsCartOpen(true);
  }

  return (
    <div className={styles.controls}>
      {variantCount > 1 ? (
        <p className={styles.selectionHint}>
          Choose options below before checkout.
        </p>
      ) : null}
      <div className={styles.quantity} aria-label="Quantity">
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
        className={styles.primaryAction}
        onClick={handleAddToCart}
        type="button"
      >
        Add to cart
      </button>
      <Link className={styles.secondaryAction} href={cartHref}>
        View cart
      </Link>
    </div>
  );
}
