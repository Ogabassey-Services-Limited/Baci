import {
  getVariantConditionOptions,
  hasVariantConditionAxis,
  resolveVariantDisplaySelection,
  resolveVariantSelection,
  sortCanonicalProductConditionsByPreference,
} from '@baci/shared/lib';
import { isInternalSelectionAxis } from '@/lib/product-internal-selection-axes';
import type { Product, ProductCondition } from '@/types/product';
import { normalizeRouteCondition } from './normalize-route-condition';

type ProductSelectionInput = {
  attributes: Record<string, string | null>;
  condition: ProductCondition | null;
  variantId: string | null;
};

// Some legacy catalogs store the color axis under `colour` (British spelling)
// instead of `color`. The shared variant resolver matches attribute keys
// exactly, so a `colour`-keyed variant will not match a selection emitted
// under `color`. Detect the legacy shape so we can emit the selected color
// under the matching key.
type ProductColorAxisShape = 'color' | 'colour' | 'both' | 'none';

function resolveProductColorAxisShape(
  product: Product | null | undefined
): ProductColorAxisShape {
  if (!product?.variants) {
    return 'none';
  }

  let hasColor = false;
  let hasColour = false;

  for (const variant of product.variants) {
    if (variant.attributes?.color?.trim()) {
      hasColor = true;
    }
    if (variant.attributes?.colour?.trim()) {
      hasColour = true;
    }
    if (hasColor && hasColour) {
      break;
    }
  }

  if (hasColor && hasColour) {
    return 'both';
  }
  if (hasColour) {
    return 'colour';
  }
  if (hasColor) {
    return 'color';
  }
  return 'none';
}

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
  const fallbackConditions = product
    ? Array.from(
        sortCanonicalProductConditionsByPreference([
          ...(product.available_conditions?.map(normalizeRouteCondition) ?? []),
          normalizeRouteCondition(product.condition),
          ...(product.offers?.map((offer) =>
            normalizeRouteCondition(offer.condition)
          ) || []),
        ])
      )
    : [];
  const availableConditions = product
    ? usesVariantConditions
      ? (() => {
          const variantConditions = getVariantConditionOptions(product)
            .map(normalizeRouteCondition)
            .filter(isProductCondition);

          return variantConditions.length > 0
            ? sortCanonicalProductConditionsByPreference(variantConditions)
            : fallbackConditions;
        })()
      : fallbackConditions
    : [];
  const defaultSelectionCondition = normalizeRouteCondition(
    defaultVariantSelection?.condition
  );
  const fallbackSelectedCondition =
    routeCondition ??
    defaultSelectionCondition ??
    availableConditions[0] ??
    normalizeRouteCondition(product?.condition);
  const resolvedColorSelection =
    selectedColor ?? routeSelectionAttributes.color ?? null;
  const colorAxisShape = resolveProductColorAxisShape(product);
  // When a product's variants only carry the legacy `colour` key, emit the
  // selection under `colour` (not `color`) so the shared resolver matches
  // exactly. When both keys exist (mixed catalog), mirror onto both so
  // legacy rows stay reachable without breaking modern matches.
  const shouldEmitColor =
    resolvedColorSelection !== null &&
    (colorAxisShape === 'color' ||
      colorAxisShape === 'both' ||
      colorAxisShape === 'none');
  const shouldEmitColour =
    resolvedColorSelection !== null &&
    (colorAxisShape === 'colour' || colorAxisShape === 'both');
  const selectionAttributes: Record<string, string | null> = {
    ...routeSelectionAttributes,
    ...selectedAttributes,
    storage: selectedStorage ?? routeSelectionAttributes.storage ?? null,
    color: shouldEmitColor ? resolvedColorSelection : null,
    ...(shouldEmitColour ? { colour: resolvedColorSelection } : {}),
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
    routeVariantId;
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
        ([axis]) => !isInternalSelectionAxis(axis)
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
