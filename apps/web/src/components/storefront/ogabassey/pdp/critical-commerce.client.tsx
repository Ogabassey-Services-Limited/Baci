'use client';

import {
  resolveDefaultVariantSelection,
  resolveVariantDisplaySelection,
  resolveVariantSelection,
} from '@baci/shared/lib';
import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getAvailableOptionsForAxis } from '@/components/storefront/ogabassey/variant-attributes';
import { useCart } from '@/hooks/cart';
import type { Product as CartProduct } from '@/lib/products';
import {
  buildVariantCartProduct,
  compactVariantOptions,
  formatCriticalPrice,
  getVariantAxesWithMultipleOptions,
  type InitialCriticalVariantSelection,
  pickInitialSelectedAttributes,
} from './critical-commerce-selection';
import {
  getRenderableCriticalVariantAxes,
  OgabasseyPdpCriticalVariantSelectors,
} from './critical-variant-selectors.client';

interface OgabasseyPdpCriticalCommerceClientProps {
  cartHref: Route;
  cartProduct: CartProduct;
  initialVariantSelection?: InitialCriticalVariantSelection;
  pricePortalTargetId?: string;
  productName: string;
  variantSelectorPortalTargetId?: string;
  variantAxes?: string[];
  variantCount: number;
}

function getPortalTarget(targetId: string | undefined) {
  if (!targetId || typeof document === 'undefined') {
    return null;
  }

  return document.getElementById(targetId);
}

export function OgabasseyPdpCriticalCommerceClient({
  cartHref,
  cartProduct,
  initialVariantSelection,
  pricePortalTargetId,
  productName,
  variantSelectorPortalTargetId,
  variantAxes = [],
  variantCount,
}: OgabasseyPdpCriticalCommerceClientProps) {
  const variants = cartProduct.variants || [];
  const renderableVariantAxes = getRenderableCriticalVariantAxes(
    variantAxes,
    variants
  );
  const initialVariantCondition =
    initialVariantSelection?.condition ?? cartProduct.condition;
  const defaultVariantSelection = cartProduct.has_variants
    ? resolveDefaultVariantSelection(cartProduct, {
        condition: initialVariantCondition,
      })
    : null;
  const initialDisplayVariantSelection = cartProduct.has_variants
    ? (resolveVariantDisplaySelection(cartProduct, {
        attributes: initialVariantSelection?.attributes,
        condition: initialVariantCondition,
        variantId: initialVariantSelection?.variantId,
      }) ?? defaultVariantSelection)
    : null;
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >(() =>
    pickInitialSelectedAttributes({
      explicitAttributes: initialVariantSelection?.attributes,
      renderableVariantAxes,
      selection: initialDisplayVariantSelection,
    })
  );
  const [selectedVariantId, setSelectedVariantId] = useState<
    string | undefined
  >(initialVariantSelection?.variantId);
  const [explicitSelectedAxes, setExplicitSelectedAxes] = useState<string[]>(
    () => Object.keys(initialVariantSelection?.attributes || {})
  );
  const purchasableVariantSelection = cartProduct.has_variants
    ? resolveVariantSelection(cartProduct, {
        attributes: selectedAttributes,
        condition: initialVariantCondition,
        variantId: selectedVariantId,
      })
    : null;
  const displayVariantSelection = cartProduct.has_variants
    ? (resolveVariantDisplaySelection(cartProduct, {
        attributes: selectedAttributes,
        condition: initialVariantCondition,
        variantId: selectedVariantId,
      }) ?? defaultVariantSelection)
    : null;
  const selectedVariantSelection =
    purchasableVariantSelection ?? displayVariantSelection;
  const productForCart = buildVariantCartProduct(
    cartProduct,
    selectedVariantSelection
  );
  const hiddenRequiredVariantAxes = getVariantAxesWithMultipleOptions(
    variants
  ).filter((axis) => !renderableVariantAxes.includes(axis));
  const hasRequiredVariantSelection =
    renderableVariantAxes.length === 0 ||
    renderableVariantAxes.every((axis) => selectedAttributes[axis]);
  const hasRequiredHiddenVariantSelection = hiddenRequiredVariantAxes.every(
    (axis) => explicitSelectedAxes.includes(axis)
  );
  const hasPurchasableVariantSelection =
    !cartProduct.has_variants || Boolean(purchasableVariantSelection);
  const maxQuantity = productForCart.manage_stock
    ? Math.max(
        0,
        typeof productForCart.stock === 'number' ? productForCart.stock : 0
      )
    : null;
  const [quantity, setQuantity] = useState(maxQuantity === 0 ? 0 : 1);
  const [previousMaxQuantity, setPreviousMaxQuantity] = useState(maxQuantity);
  const { addToCart, setIsCartOpen } = useCart();

  if (previousMaxQuantity !== maxQuantity) {
    setPreviousMaxQuantity(maxQuantity);
    setQuantity((current) => {
      if (maxQuantity === null) {
        return Math.max(1, current);
      }

      if (maxQuantity === 0) {
        return 0;
      }

      return Math.min(Math.max(1, current), maxQuantity);
    });
  }

  const isAtMaxQuantity = maxQuantity !== null && quantity >= maxQuantity;
  const canAddToCart =
    hasRequiredVariantSelection &&
    hasRequiredHiddenVariantSelection &&
    hasPurchasableVariantSelection &&
    quantity >= 1 &&
    (maxQuantity === null || (maxQuantity > 0 && quantity <= maxQuantity));

  function handleAttributeSelection(axis: string, value: string) {
    setSelectedVariantId(undefined);
    setExplicitSelectedAxes((current) =>
      current.includes(axis) ? current : [...current, axis]
    );
    setSelectedAttributes((current) => {
      const next = { ...current, [axis]: value };

      return Object.fromEntries(
        Object.entries(next).filter(([key, selectedValue]) => {
          if (key === axis) {
            return true;
          }

          return getAvailableOptionsForAxis(
            key,
            variants,
            Object.fromEntries(
              Object.entries(next).filter(([entryKey]) => entryKey !== key)
            )
          ).includes(selectedValue);
        })
      );
    });
  }

  function handleAddToCart() {
    if (!canAddToCart) {
      return;
    }

    const variantOptions = purchasableVariantSelection
      ? compactVariantOptions({
          color:
            purchasableVariantSelection.color ??
            purchasableVariantSelection.attributes.color,
          condition:
            purchasableVariantSelection.condition ?? productForCart.condition,
          storage:
            purchasableVariantSelection.storage ??
            purchasableVariantSelection.attributes.storage,
          variantAttributes: purchasableVariantSelection.attributes,
          variantId: purchasableVariantSelection.variant.id,
        })
      : productForCart.condition
        ? { condition: productForCart.condition }
        : undefined;

    addToCart(productForCart, quantity, variantOptions);
    setIsCartOpen(true);
  }

  const variantSelectorContent = (
    <OgabasseyPdpCriticalVariantSelectors
      explicitSelectedAxes={explicitSelectedAxes}
      onAttributeSelection={handleAttributeSelection}
      renderableVariantAxes={renderableVariantAxes}
      selectedAttributes={selectedAttributes}
      variantCount={variantCount}
      variants={variants}
    />
  );
  const pricePortalTarget = getPortalTarget(pricePortalTargetId);
  const renderedPrice = pricePortalTarget
    ? createPortal(formatCriticalPrice(productForCart.price), pricePortalTarget)
    : null;
  const variantSelectorPortalTarget = getPortalTarget(
    variantSelectorPortalTargetId
  );
  const renderedVariantSelectors = variantSelectorPortalTargetId
    ? variantSelectorPortalTarget
      ? createPortal(variantSelectorContent, variantSelectorPortalTarget)
      : null
    : variantSelectorContent;

  return (
    <>
      {renderedPrice}
      {renderedVariantSelectors}
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
    </>
  );
}
