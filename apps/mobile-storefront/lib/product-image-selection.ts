import { normalizeCanonicalProductCondition } from '@baci/shared/lib';
import { isInternalSelectionAxis } from '@/lib/product-internal-selection-axes';
import type { ProductVariant } from '@/types/product';

interface ResolveVariantSelectionFromImageInput {
  imageUrl: string | null | undefined;
  manageStock?: boolean;
  selectedAttributes?: Record<string, string>;
  selectedCondition?: string | null;
  selectedStorage?: string | null;
  variants?: ProductVariant[] | null;
}

function isVariantPurchasable(
  variant: ProductVariant,
  manageStock: boolean | undefined
) {
  if (manageStock === false) {
    return true;
  }
  if (typeof variant.stock_quantity === 'number') {
    return variant.stock_quantity > 0;
  }
  return variant.in_stock !== false;
}

interface ResolvedVariantSelectionFromImage {
  color: string | null;
  variantId: string | null;
}

function pickPreferredMatches(
  candidates: ProductVariant[],
  manageStock: boolean | undefined
) {
  const purchasable = candidates.filter((variant) =>
    isVariantPurchasable(variant, manageStock)
  );
  return purchasable.length > 0 ? purchasable : candidates;
}

function normalizeValue(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function getVariantImageUrls(variant: ProductVariant) {
  return Array.from(
    new Set(
      [
        normalizeValue(variant.image),
        ...(variant.images ?? []).map(normalizeValue),
      ].filter(Boolean)
    )
  );
}

function matchesSelectedAttributes(
  variant: ProductVariant,
  selectedAttributes: Record<string, string>
) {
  const variantAttributes = variant.attributes ?? {};

  return Object.entries(selectedAttributes).every(
    ([axis, value]) =>
      normalizeValue(variantAttributes[axis]) === normalizeValue(value)
  );
}

export function resolveVariantSelectionFromImage({
  imageUrl,
  manageStock,
  selectedAttributes,
  selectedCondition,
  selectedStorage,
  variants,
}: ResolveVariantSelectionFromImageInput): ResolvedVariantSelectionFromImage | null {
  const normalizedImageUrl = normalizeValue(imageUrl);
  if (!normalizedImageUrl) {
    return null;
  }

  const imageMatches = (variants ?? []).filter((variant) =>
    getVariantImageUrls(variant).includes(normalizedImageUrl)
  );

  if (imageMatches.length === 0) {
    return null;
  }

  const requestedAttributes = Object.fromEntries(
    Object.entries({
      ...Object.fromEntries(
        Object.entries(selectedAttributes ?? {}).filter(
          ([axis]) => !isInternalSelectionAxis(axis)
        )
      ),
      ...(selectedStorage ? { storage: selectedStorage } : {}),
    }).filter(
      (entry): entry is [string, string] => normalizeValue(entry[1]).length > 0
    )
  );

  const exactAttributeMatches =
    Object.keys(requestedAttributes).length > 0
      ? imageMatches.filter((variant) =>
          matchesSelectedAttributes(variant, requestedAttributes)
        )
      : imageMatches;

  const normalizedSelectedCondition =
    normalizeCanonicalProductCondition(selectedCondition);
  const conditionMatches =
    normalizedSelectedCondition &&
    exactAttributeMatches.some(
      (variant) =>
        normalizeCanonicalProductCondition(variant.condition) ===
        normalizedSelectedCondition
    )
      ? exactAttributeMatches.filter(
          (variant) =>
            normalizeCanonicalProductCondition(variant.condition) ===
            normalizedSelectedCondition
        )
      : exactAttributeMatches;

  // Prefer purchasable candidates at each narrowing level so a shared image
  // that maps to both in-stock and out-of-stock rows never routes the shopper
  // to an unavailable SKU. Falling back to the original match keeps the color
  // swatch behavior stable even when no purchasable match exists.
  const preferredConditionMatches = pickPreferredMatches(
    conditionMatches,
    manageStock
  );
  const preferredImageMatches = pickPreferredMatches(imageMatches, manageStock);
  const resolvedVariant =
    preferredConditionMatches[0] ?? preferredImageMatches[0];
  const variantIsPurchasable = isVariantPurchasable(
    resolvedVariant,
    manageStock
  );
  return {
    color:
      normalizeValue(
        resolvedVariant.attributes?.color ?? resolvedVariant.attributes?.colour
      ) || null,
    // Only propagate variantId when the resolved row is purchasable; otherwise
    // let the caller keep the previously selected variant rather than silently
    // overwriting it with an out-of-stock SKU that can slip into the cart via
    // `effectiveSelectedVariantId`.
    variantId: variantIsPurchasable
      ? normalizeValue(resolvedVariant.id) || null
      : null,
  };
}
