import { stripInternalSelectionAxes } from '@/lib/product-internal-selection-axes';
import { normalizeRouteCondition } from '@/lib/product-route/normalize-route-condition';
import type { ProductCondition, ProductVariant } from '@/types/product';

interface ResolveLinkedVariantSelectionInput {
  axis: string;
  attributes: Record<string, string>;
  color: string | null;
  condition: ProductCondition | null;
  storage: string | null;
  usesVariantConditions: boolean;
  value: string;
  variants?: ProductVariant[] | null;
}

interface LinkedVariantSelection {
  attributes: Record<string, string>;
  color: string | null;
  storage: string | null;
}

function canonicalizeVariantAxis(axis: string) {
  return axis.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizeAttributeMap(
  attributes: Record<string, string> | null | undefined
) {
  const normalized: Record<string, string> = {};

  for (const [axis, value] of Object.entries(attributes ?? {})) {
    const normalizedAxis = canonicalizeVariantAxis(axis);
    const normalizedValue = value.trim();
    if (normalizedAxis && normalizedValue) {
      normalized[normalizedAxis] = normalizedValue;
    }
  }

  return normalized;
}

function getVisibleVariantAttributes(variant: ProductVariant) {
  return stripInternalSelectionAxes(normalizeAttributeMap(variant.attributes));
}

function getVariantStorage(variant: ProductVariant) {
  return normalizeAttributeMap(variant.attributes).storage ?? null;
}

function getVariantColor(variant: ProductVariant) {
  const attributes = normalizeAttributeMap(variant.attributes);
  return attributes.color ?? attributes.colour ?? null;
}

function matchesCondition(
  input: ResolveLinkedVariantSelectionInput,
  variant: ProductVariant
) {
  if (!input.usesVariantConditions || !input.condition) {
    return true;
  }

  return normalizeRouteCondition(variant.condition) === input.condition;
}

function matchesColor(
  input: ResolveLinkedVariantSelectionInput,
  variant: ProductVariant
) {
  if (!input.color) {
    return true;
  }

  return getVariantColor(variant) === input.color;
}

function matchesStorage(variant: ProductVariant, storage: string | null) {
  return !storage || getVariantStorage(variant) === storage;
}

function matchesAttributes(
  variant: ProductVariant,
  attributes: Record<string, string>
) {
  const variantAttributes = normalizeAttributeMap(variant.attributes);

  return Object.entries(attributes).every(
    ([axis, value]) => variantAttributes[axis] === value
  );
}

function matchesChangedAxis(
  variant: ProductVariant,
  axis: string,
  value: string
) {
  const normalizedAxis = canonicalizeVariantAxis(axis);

  if (normalizedAxis === 'storage') {
    return getVariantStorage(variant) === value;
  }

  return normalizeAttributeMap(variant.attributes)[normalizedAxis] === value;
}

// Match the current selection first, then progressively relax only the axes
// that made linked variant groups feel untappable in the UI.
function findLinkedVariant(input: ResolveLinkedVariantSelectionInput) {
  const variants = input.variants ?? [];
  if (variants.length === 0) {
    return null;
  }

  const exactMatch = variants.find(
    (variant) =>
      matchesCondition(input, variant) &&
      matchesColor(input, variant) &&
      matchesStorage(variant, input.storage) &&
      matchesAttributes(variant, input.attributes)
  );

  if (exactMatch) {
    return exactMatch;
  }

  const fallbackMatchWithColor = variants.find(
    (variant) =>
      matchesCondition(input, variant) &&
      matchesColor(input, variant) &&
      matchesChangedAxis(variant, input.axis, input.value)
  );

  if (fallbackMatchWithColor) {
    return fallbackMatchWithColor;
  }

  return (
    variants.find(
      (variant) =>
        matchesCondition(input, variant) &&
        matchesChangedAxis(variant, input.axis, input.value)
    ) ??
    variants.find((variant) =>
      matchesChangedAxis(variant, input.axis, input.value)
    ) ??
    null
  );
}

export function resolveLinkedVariantSelection(
  input: ResolveLinkedVariantSelectionInput
): LinkedVariantSelection | null {
  const variant = findLinkedVariant(input);
  if (!variant) {
    return null;
  }

  return {
    attributes: getVisibleVariantAttributes(variant),
    color: getVariantColor(variant),
    storage: getVariantStorage(variant),
  };
}
