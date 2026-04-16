import {
  getVariantConditionOptions,
  normalizeCanonicalProductCondition,
  type ResolvedProductVariantSelection,
  resolveVariantDisplaySelection,
  resolveVariantSelection,
} from '@baci/shared/lib';
import type { Product, ProductCondition } from '@/types/product';

type ProductVariantSelection = ResolvedProductVariantSelection<{
  compare_at_price?: number | null;
  id: string;
  image?: string;
  images?: string[];
  in_stock?: boolean;
  name?: string;
  stock_quantity?: number;
}>;

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

export function normalizeRouteCondition(
  value: string | string[] | null | undefined
): ProductCondition | null {
  const normalized = normalizeCanonicalProductCondition(
    typeof value === 'string' ? value : null
  );
  return normalized || null;
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
  const usesVariantConditions = product ? product.has_variants === true : false;
  const availableConditions = product
    ? ((usesVariantConditions
        ? (getVariantConditionOptions(product) as ProductCondition[])
        : Array.from(
            new Set(
              [
                normalizeRouteCondition(product.condition),
                ...(product.offers?.map((offer) =>
                  normalizeRouteCondition(offer.condition)
                ) || []),
              ].filter(Boolean)
            )
          )) as ProductCondition[])
    : [];
  const fallbackSelectedCondition =
    routeCondition ??
    availableConditions[0] ??
    normalizeRouteCondition(product?.condition);
  const selectionAttributes = {
    storage: selectedStorage ?? routeSelectionAttributes.storage ?? null,
    color: selectedColor ?? routeSelectionAttributes.color ?? null,
    ...routeSelectionAttributes,
    ...selectedAttributes,
  };
  const shouldUseDefaultVariantSelection =
    !selectedVariant &&
    !selectedStorage &&
    !selectedColor &&
    Object.keys(selectedAttributes).length === 0;
  const currentVariantDisplaySelection = product?.has_variants
    ? ((resolveVariantDisplaySelection(product, {
        condition: selectedCondition ?? fallbackSelectedCondition,
        variantId: selectedVariant ?? routeVariantId,
        attributes: selectionAttributes,
      }) as ProductVariantSelection | null) ??
      (shouldUseDefaultVariantSelection ? defaultVariantSelection : null))
    : null;
  const effectiveSelectedCondition =
    normalizeRouteCondition(currentVariantDisplaySelection?.condition) ??
    selectedCondition ??
    fallbackSelectedCondition;
  const currentVariantSelection = product?.has_variants
    ? (resolveVariantSelection(product, {
        condition: effectiveSelectedCondition,
        variantId: selectedVariant ?? routeVariantId,
        attributes: selectionAttributes,
      }) as ProductVariantSelection | null)
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
