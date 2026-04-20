import {
  getVariantConditionOptions,
  hasVariantConditionAxis,
  resolveVariantDisplaySelection,
  resolveVariantSelection,
} from '@baci/shared/lib';
import type { Product, ProductCondition } from '@/types/product';
import { normalizeRouteCondition } from './normalize-route-condition';

type ProductSelectionInput = {
  attributes: Record<string, string | null>;
  condition: ProductCondition | null;
  variantId: string | null;
};

function isProductCondition(
  value: ProductCondition | null
): value is ProductCondition {
  return value !== null;
}

function resolveProductVariantDisplaySelection(
  product: Product,
  selection: ProductSelectionInput
) {
  return resolveVariantDisplaySelection(product, selection);
}

function resolveProductVariantSelection(
  product: Product,
  selection: ProductSelectionInput
) {
  return resolveVariantSelection(product, selection);
}

type ProductVariantSelection = ReturnType<
  typeof resolveProductVariantDisplaySelection
>;

interface ComputeProductSelectionOptions {
  defaultVariantSelection: ProductVariantSelection | null;
  product: Product | null;
  routeCondition: ProductCondition | null;
  routeSelectionAttributes: Record<string, string>;
  routeVariantId: string | null;
  selectedAttributes: Record<string, string>;
  selectedColor: string | null;
  selectedCondition: ProductCondition | null;
  selectedStorage: string | null;
  selectedVariant: string | null;
}

export function computeProductSelectionState({
  defaultVariantSelection,
  product,
  routeCondition,
  routeSelectionAttributes,
  routeVariantId,
  selectedAttributes,
  selectedColor,
  selectedCondition,
  selectedStorage,
  selectedVariant,
}: ComputeProductSelectionOptions) {
  const usesVariantConditions = product
    ? hasVariantConditionAxis(product)
    : false;
  const availableConditions = product
    ? usesVariantConditions
      ? getVariantConditionOptions(product)
          .map(normalizeRouteCondition)
          .filter(isProductCondition)
      : Array.from(
          new Set(
            [
              normalizeRouteCondition(product.condition),
              ...(product.offers?.map((offer) =>
                normalizeRouteCondition(offer.condition)
              ) || []),
            ].filter(isProductCondition)
          )
        )
    : [];
  const fallbackSelectedCondition =
    routeCondition ??
    availableConditions[0] ??
    normalizeRouteCondition(product?.condition);
  const selectionAttributes = {
    ...routeSelectionAttributes,
    ...selectedAttributes,
    storage: selectedStorage ?? routeSelectionAttributes.storage ?? null,
    color: selectedColor ?? routeSelectionAttributes.color ?? null,
  };
  const shouldUseDefaultVariantSelection =
    !selectedVariant &&
    !selectedStorage &&
    !selectedColor &&
    Object.keys(selectedAttributes).length === 0;
  const currentVariantDisplaySelection = product?.has_variants
    ? (resolveProductVariantDisplaySelection(product, {
        condition: selectedCondition ?? fallbackSelectedCondition,
        variantId: selectedVariant ?? routeVariantId,
        attributes: selectionAttributes,
      }) ?? (shouldUseDefaultVariantSelection ? defaultVariantSelection : null))
    : null;
  const effectiveSelectedCondition =
    normalizeRouteCondition(currentVariantDisplaySelection?.condition) ??
    selectedCondition ??
    fallbackSelectedCondition;
  const currentVariantSelection = product?.has_variants
    ? resolveProductVariantSelection(product, {
        condition: effectiveSelectedCondition,
        variantId: selectedVariant ?? routeVariantId,
        attributes: selectionAttributes,
      })
    : null;
  const effectiveSelectedVariantId =
    currentVariantDisplaySelection?.variant.id ??
    selectedVariant ??
    (typeof routeVariantId === 'string' ? routeVariantId : null);
  const effectiveSelectedStorage =
    currentVariantDisplaySelection?.storage ??
    selectedStorage ??
    routeSelectionAttributes.storage ??
    null;
  const effectiveSelectedColor =
    currentVariantDisplaySelection?.color ??
    selectedColor ??
    routeSelectionAttributes.color ??
    null;
  const effectiveSelectedAttributes = {
    ...selectedAttributes,
    ...Object.fromEntries(
      Object.entries(currentVariantDisplaySelection?.attributes ?? {}).filter(
        ([axis]) => axis !== 'color' && axis !== 'storage'
      )
    ),
  };

  return {
    availableConditions,
    currentVariantDisplaySelection,
    currentVariantSelection,
    effectiveSelectedAttributes,
    effectiveSelectedColor,
    effectiveSelectedCondition,
    effectiveSelectedStorage,
    effectiveSelectedVariantId,
    fallbackSelectedCondition,
    usesVariantConditions,
  };
}
