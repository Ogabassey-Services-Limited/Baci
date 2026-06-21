'use client';

import {
  resolveDefaultVariantSelection,
  resolveVariantDisplaySelection,
  resolveVariantSelection,
} from '@baci/shared/lib';
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  canonicalizeVariantAxis,
  getAvailableOptionsForAxis,
} from '@/components/storefront/ogabassey/variant-attributes';
import { useCart } from '@/hooks/cart';
import type { Product as CartProduct } from '@/lib/products';
import {
  buildVariantCartProduct,
  compactVariantOptions,
  getVariantAxesWithMultipleOptions,
  type InitialCriticalVariantSelection,
  normalizeCriticalVariantAttributes,
  normalizeCriticalVariantProduct,
  pickInitialSelectedAttributes,
} from './critical-commerce-selection';
import { getRenderableCriticalVariantAxes } from './critical-variant-selectors.client';

interface OgabasseyPdpCriticalCommerceProviderProps {
  cartProduct: CartProduct;
  children: ReactNode;
  initialVariantSelection?: InitialCriticalVariantSelection;
  variantAxes?: string[];
  variantCount: number;
}

interface OgabasseyPdpCriticalCommerceState {
  canAddToCart: boolean;
  explicitSelectedAxes: string[];
  handleAddToCart: () => void;
  handleAttributeSelection: (axis: string, value: string) => void;
  isAtMaxQuantity: boolean;
  maxQuantity: number | null;
  productForCart: CartProduct;
  quantity: number;
  renderableVariantAxes: string[];
  selectedAttributes: Record<string, string>;
  setQuantity: Dispatch<SetStateAction<number>>;
  variantCount: number;
  variants: CartProduct['variants'];
}

const OgabasseyPdpCriticalCommerceContext =
  createContext<OgabasseyPdpCriticalCommerceState | null>(null);

export function useOgabasseyPdpCriticalCommerce() {
  const context = useContext(OgabasseyPdpCriticalCommerceContext);
  if (!context) {
    throw new Error(
      'Ogabassey PDP critical commerce components must be rendered inside OgabasseyPdpCriticalCommerceProvider.'
    );
  }

  return context;
}

export function OgabasseyPdpCriticalCommerceProvider({
  cartProduct,
  children,
  initialVariantSelection,
  variantAxes = [],
  variantCount,
}: OgabasseyPdpCriticalCommerceProviderProps) {
  const selectionCartProduct = normalizeCriticalVariantProduct(cartProduct);
  const variants = selectionCartProduct.variants || [];
  const firstViewportVariantAxes = getRenderableCriticalVariantAxes(
    variantAxes,
    variants
  );
  const requiredVariantAxes = getVariantAxesWithMultipleOptions(variants);
  const renderableVariantAxes = firstViewportVariantAxes;
  const hiddenRequiredVariantAxes = requiredVariantAxes.filter(
    (axis) => !renderableVariantAxes.includes(axis)
  );
  const normalizedInitialVariantAttributes =
    normalizeCriticalVariantAttributes(initialVariantSelection?.attributes);
  const explicitVariantCondition =
    normalizedInitialVariantAttributes.condition ??
    initialVariantSelection?.condition;
  const normalizedInitialSelectionAttributes = explicitVariantCondition
    ? {
        ...normalizedInitialVariantAttributes,
        condition: explicitVariantCondition,
      }
    : normalizedInitialVariantAttributes;
  const resolverInitialVariantAttributes = Object.fromEntries(
    Object.entries(normalizedInitialVariantAttributes).filter(
      ([axis]) => axis !== 'condition'
    )
  );
  const initialExplicitSelectedAxes = Object.keys(
    normalizedInitialSelectionAttributes
  );
  if (
    explicitVariantCondition &&
    !initialExplicitSelectedAxes.includes('condition')
  ) {
    initialExplicitSelectedAxes.push('condition');
  }
  const defaultVariantSelection = selectionCartProduct.has_variants
    ? resolveDefaultVariantSelection(selectionCartProduct, {
        condition: explicitVariantCondition,
      })
    : null;
  const initialDisplayVariantSelection = selectionCartProduct.has_variants
    ? (resolveVariantDisplaySelection(selectionCartProduct, {
        attributes: resolverInitialVariantAttributes,
        condition: explicitVariantCondition,
        variantId: initialVariantSelection?.variantId,
      }) ?? defaultVariantSelection)
    : null;
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >(() =>
    pickInitialSelectedAttributes({
      explicitAttributes: normalizedInitialSelectionAttributes,
      renderableVariantAxes,
      selection: initialDisplayVariantSelection,
    })
  );
  const [selectedVariantId, setSelectedVariantId] = useState<
    string | undefined
  >(initialVariantSelection?.variantId);
  const [explicitSelectedAxes, setExplicitSelectedAxes] = useState<string[]>(
    () => initialExplicitSelectedAxes
  );
  const selectedVariantCondition =
    selectedAttributes.condition ?? explicitVariantCondition;
  const resolverSelectedAttributes = Object.fromEntries(
    Object.entries(selectedAttributes).filter(([axis]) => axis !== 'condition')
  );
  const purchasableVariantSelection = selectionCartProduct.has_variants
    ? resolveVariantSelection(selectionCartProduct, {
        attributes: resolverSelectedAttributes,
        condition: selectedVariantCondition,
        variantId: selectedVariantId,
      })
    : null;
  const displayVariantSelection = selectionCartProduct.has_variants
    ? (resolveVariantDisplaySelection(selectionCartProduct, {
        attributes: resolverSelectedAttributes,
        condition: selectedVariantCondition,
        variantId: selectedVariantId,
      }) ?? defaultVariantSelection)
    : null;
  const requiresVariantSelection =
    renderableVariantAxes.length > 0 || hiddenRequiredVariantAxes.length > 0;
  const effectivePurchasableVariantSelection =
    purchasableVariantSelection ??
    (requiresVariantSelection ? null : defaultVariantSelection);
  const selectedVariantSelection =
    effectivePurchasableVariantSelection ?? displayVariantSelection;
  const productForCart = buildVariantCartProduct(
    selectionCartProduct,
    selectedVariantSelection
  );
  const hasRequiredVariantSelection =
    renderableVariantAxes.length === 0 ||
    renderableVariantAxes.every((axis) => selectedAttributes[axis]);
  function getSelectedAxisValue(axis: string) {
    if (axis === 'condition') {
      return selectedAttributes.condition ?? explicitVariantCondition;
    }

    return selectedAttributes[axis];
  }

  const missingHiddenRequiredVariantAxes = hiddenRequiredVariantAxes.filter(
    (axis) => !(explicitSelectedAxes.includes(axis) && getSelectedAxisValue(axis))
  );
  const hasRequiredHiddenVariantSelection =
    missingHiddenRequiredVariantAxes.length === 0;
  const missingHiddenRequiredVariantAxisKey =
    missingHiddenRequiredVariantAxes.join('|');
  const hasPurchasableVariantSelection =
    !selectionCartProduct.has_variants ||
    Boolean(effectivePurchasableVariantSelection);
  const maxQuantity = productForCart.manage_stock
    ? Math.max(
        0,
        typeof productForCart.stock === 'number' ? productForCart.stock : 0
      )
    : null;
  const [quantity, setQuantity] = useState(maxQuantity === 0 ? 0 : 1);
  const [previousMaxQuantity, setPreviousMaxQuantity] = useState(maxQuantity);
  const { addToCart, setIsCartOpen } = useCart();

  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'development' ||
      !missingHiddenRequiredVariantAxisKey
    ) {
      return;
    }

    console.warn(
      '[Ogabassey PDP] Missing hidden required variant selection.',
      {
        axes: missingHiddenRequiredVariantAxisKey.split('|'),
        productId: selectionCartProduct.id,
      }
    );
  }, [missingHiddenRequiredVariantAxisKey, selectionCartProduct.id]);

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
    const normalizedAxis = canonicalizeVariantAxis(axis);
    if (!normalizedAxis) {
      return;
    }

    setSelectedVariantId(undefined);
    setExplicitSelectedAxes((current) =>
      current.includes(normalizedAxis) ? current : [...current, normalizedAxis]
    );
    setSelectedAttributes((current) => {
      const next = { ...current, [normalizedAxis]: value.trim() };

      return Object.fromEntries(
        Object.entries(next).filter(([key, selectedValue]) => {
          if (key === normalizedAxis) {
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

    const variantOptions = effectivePurchasableVariantSelection
      ? compactVariantOptions({
          color:
            effectivePurchasableVariantSelection.color ??
            effectivePurchasableVariantSelection.attributes.color,
          condition:
            effectivePurchasableVariantSelection.condition ??
            productForCart.condition,
          storage:
            effectivePurchasableVariantSelection.storage ??
            effectivePurchasableVariantSelection.attributes.storage,
          variantAttributes: effectivePurchasableVariantSelection.attributes,
          variantId: effectivePurchasableVariantSelection.variant.id,
        })
      : productForCart.condition
        ? { condition: productForCart.condition }
        : undefined;

    addToCart(productForCart, quantity, variantOptions);
    setIsCartOpen(true);
  }

  return (
    <OgabasseyPdpCriticalCommerceContext.Provider
      value={{
        canAddToCart,
        explicitSelectedAxes,
        handleAddToCart,
        handleAttributeSelection,
        isAtMaxQuantity,
        maxQuantity,
        productForCart,
        quantity,
        renderableVariantAxes,
        selectedAttributes,
        setQuantity,
        variantCount,
        variants,
      }}
    >
      {children}
    </OgabasseyPdpCriticalCommerceContext.Provider>
  );
}
