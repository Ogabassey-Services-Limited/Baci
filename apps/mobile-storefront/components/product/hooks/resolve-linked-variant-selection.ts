import { stripInternalSelectionAxes } from '@/lib/product-internal-selection-axes';
import { normalizeRouteCondition } from '@/lib/product-route/normalize-route-condition';
import type { ProductCondition, ProductVariant } from '@/types/product';

interface ResolveLinkedVariantSelectionInput {
  axis: string;
  attributes: Record<string, string>;
  color: string | null;
  condition: ProductCondition | null;
  preserveConditionAttribute?: boolean;
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

interface NormalizedSelectionInput
  extends Omit<
    ResolveLinkedVariantSelectionInput,
    'attributes' | 'axis' | 'color' | 'storage' | 'value'
  > {
  attributes: Record<string, string>;
  axis: string;
  color: string | null;
  preserveConditionAttribute: boolean;
  storage: string | null;
  value: string;
}

interface NormalizedVariantCandidate {
  attributes: Record<string, string>;
  color: string | null;
  condition: ProductCondition | null;
  storage: string | null;
  visibleAttributes: Record<string, string>;
}

function canonicalizeVariantAxis(axis: string) {
  return axis
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function normalizeSelectionValue(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
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

function getVariantColor(attributes: Record<string, string>) {
  return attributes.color ?? attributes.colour ?? null;
}

function normalizeInput(
  input: ResolveLinkedVariantSelectionInput
): NormalizedSelectionInput {
  const axis = canonicalizeVariantAxis(input.axis);
  const attributes = normalizeAttributeMap(input.attributes);

  return {
    ...input,
    attributes,
    axis,
    color: normalizeSelectionValue(input.color),
    preserveConditionAttribute:
      input.preserveConditionAttribute ||
      axis === 'condition' ||
      (!input.usesVariantConditions && Boolean(attributes.condition)),
    storage: normalizeSelectionValue(input.storage),
    value: input.value.trim(),
  };
}

function normalizeVariantCandidate(
  variant: ProductVariant,
  options: { preserveConditionAttribute: boolean }
): NormalizedVariantCandidate {
  const attributes = normalizeAttributeMap(variant.attributes);

  return {
    attributes,
    color: getVariantColor(attributes),
    condition: normalizeRouteCondition(variant.condition),
    storage: attributes.storage ?? null,
    visibleAttributes: stripInternalSelectionAxes(attributes, {
      preserveCondition: options.preserveConditionAttribute,
    }),
  };
}

function matchesCondition(
  input: NormalizedSelectionInput,
  variant: NormalizedVariantCandidate
) {
  if (!input.usesVariantConditions || !input.condition) {
    return true;
  }

  return variant.condition === input.condition;
}

function matchesColor(
  input: NormalizedSelectionInput,
  variant: NormalizedVariantCandidate
) {
  if (!input.color) {
    return true;
  }

  return variant.color === input.color;
}

function matchesStorage(
  variant: NormalizedVariantCandidate,
  storage: string | null
) {
  return !storage || variant.storage === storage;
}

function matchesAttributes(
  variant: NormalizedVariantCandidate,
  attributes: Record<string, string>
) {
  return Object.entries(attributes).every(
    ([axis, value]) => variant.attributes[axis] === value
  );
}

function matchesChangedAxis(
  variant: NormalizedVariantCandidate,
  input: NormalizedSelectionInput
) {
  if (input.axis === 'storage') {
    return variant.storage === input.value;
  }
  if (input.axis === 'color' || input.axis === 'colour') {
    return variant.color === input.value;
  }

  return variant.attributes[input.axis] === input.value;
}

// Match the current selection first, then progressively relax only the axes
// that made linked variant groups feel untappable in the UI.
function findLinkedVariant(input: NormalizedSelectionInput) {
  const variants = (input.variants ?? []).map((variant) =>
    normalizeVariantCandidate(variant, {
      preserveConditionAttribute: input.preserveConditionAttribute,
    })
  );
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
      matchesChangedAxis(variant, input)
  );

  if (fallbackMatchWithColor) {
    return fallbackMatchWithColor;
  }

  return (
    variants.find(
      (variant) =>
        matchesCondition(input, variant) && matchesChangedAxis(variant, input)
    ) ??
    variants.find((variant) => matchesChangedAxis(variant, input)) ??
    null
  );
}

export function resolveLinkedVariantSelection(
  input: ResolveLinkedVariantSelectionInput
): LinkedVariantSelection | null {
  const variant = findLinkedVariant(normalizeInput(input));
  if (!variant) {
    return null;
  }

  return {
    attributes: variant.visibleAttributes,
    color: variant.color,
    storage: variant.storage,
  };
}
