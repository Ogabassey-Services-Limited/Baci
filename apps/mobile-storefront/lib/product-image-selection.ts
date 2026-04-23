import { normalizeCanonicalProductCondition } from '@baci/shared/lib';
import { isInternalSelectionAxis } from '@/lib/product-internal-selection-axes';
import type { ProductVariant } from '@/types/product';

interface ResolveVariantSelectionFromImageInput {
  imageUrl: string | null | undefined;
  selectedAttributes?: Record<string, string>;
  selectedCondition?: string | null;
  selectedStorage?: string | null;
  variants?: ProductVariant[] | null;
}

interface ResolvedVariantSelectionFromImage {
  color: string | null;
  variantId: string | null;
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

  const resolvedVariant = conditionMatches[0] ?? imageMatches[0];
  return {
    color:
      normalizeValue(
        resolvedVariant.attributes?.color ?? resolvedVariant.attributes?.colour
      ) || null,
    variantId: normalizeValue(resolvedVariant.id) || null,
  };
}
