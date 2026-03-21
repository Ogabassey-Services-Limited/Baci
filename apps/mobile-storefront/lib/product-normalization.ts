interface VariantAttributeDefinition {
  options?: unknown;
  param?: unknown;
}

export type VariantAttributeSource =
  | Record<string, unknown>
  | VariantAttributeDefinition[]
  | null
  | undefined;

export const PRODUCT_PLACEHOLDER_IMAGE =
  'https://placehold.co/400x400/f3f4f6/9ca3af?text=No+Image';

function canonicalizeVariantAxis(axis: string) {
  return axis.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizeStringArray(values: unknown) {
  const input = Array.isArray(values) ? values : [values];
  const normalized = input.reduce<string[]>((result, value) => {
    if (typeof value !== 'string') {
      return result;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue || result.includes(trimmedValue)) {
      return result;
    }

    result.push(trimmedValue);
    return result;
  }, []);

  return normalized;
}

export function normalizeProductImages(images: unknown) {
  if (!Array.isArray(images)) {
    return [];
  }

  return normalizeStringArray(images);
}

export function getPrimaryProductImage(images: unknown) {
  return normalizeProductImages(images)[0] || PRODUCT_PLACEHOLDER_IMAGE;
}

export function getProductCardImageAttempt(images: unknown, attempt: number) {
  const normalizedImages = normalizeProductImages(images);

  if (
    Number.isInteger(attempt) &&
    attempt >= 0 &&
    attempt < normalizedImages.length
  ) {
    return normalizedImages[attempt];
  }

  return PRODUCT_PLACEHOLDER_IMAGE;
}

export function normalizeVariantAttributes(source: VariantAttributeSource) {
  const normalizedAttributes: Record<string, string[]> = {};

  if (Array.isArray(source)) {
    for (const attribute of source) {
      if (!attribute || typeof attribute !== 'object') {
        continue;
      }

      const axis =
        typeof attribute.param === 'string'
          ? canonicalizeVariantAxis(attribute.param)
          : '';
      if (!axis) {
        continue;
      }

      const options = normalizeStringArray(attribute.options);
      if (options.length > 0) {
        normalizedAttributes[axis] = options;
      }
    }

    return Object.keys(normalizedAttributes).length > 0
      ? normalizedAttributes
      : undefined;
  }

  if (!source || typeof source !== 'object') {
    return undefined;
  }

  for (const [rawAxis, rawOptions] of Object.entries(source)) {
    const axis = canonicalizeVariantAxis(rawAxis);
    if (!axis) {
      continue;
    }

    const options = normalizeStringArray(rawOptions);
    if (options.length > 0) {
      normalizedAttributes[axis] = options;
    }
  }

  return Object.keys(normalizedAttributes).length > 0
    ? normalizedAttributes
    : undefined;
}
