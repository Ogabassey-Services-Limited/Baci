interface ProductImageObject {
  src?: unknown;
  uri?: unknown;
  url?: unknown;
}

interface ProductSpecificationItem {
  label?: unknown;
  value?: unknown;
}

interface ProductSpecificationSection {
  items?: unknown;
}

export type VariantAttributeSource = unknown;

interface VariantAttributeCarrier {
  attributes?: Record<string, string> | null;
}

export const PRODUCT_PLACEHOLDER_IMAGE =
  'https://placehold.co/400x400/f3f4f6/9ca3af?text=No+Image';

function canonicalizeVariantAxis(axis: string) {
  return axis
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
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

function normalizeAttributeValue(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function normalizeSpecificationValue(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function getImageCandidate(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const image = value as ProductImageObject;
  const candidate =
    typeof image.url === 'string'
      ? image.url
      : typeof image.src === 'string'
        ? image.src
        : typeof image.uri === 'string'
          ? image.uri
          : null;

  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeProductImages(images: unknown) {
  if (!Array.isArray(images)) {
    return [];
  }

  const normalized = images.reduce<string[]>((result, value) => {
    const candidate = getImageCandidate(value);
    if (!candidate || result.includes(candidate)) {
      return result;
    }

    result.push(candidate);
    return result;
  }, []);

  return normalized;
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

export function normalizeProductSpecifications(specifications: unknown) {
  const normalized: Record<string, string> = {};

  if (Array.isArray(specifications)) {
    for (const section of specifications) {
      if (!section || typeof section !== 'object') {
        continue;
      }

      const items = Array.isArray(
        (section as ProductSpecificationSection).items
      )
        ? ((section as ProductSpecificationSection).items as unknown[])
        : [];

      for (const item of items) {
        if (!item || typeof item !== 'object') {
          continue;
        }

        const rawLabel = (item as ProductSpecificationItem).label;
        const label = typeof rawLabel === 'string' ? rawLabel.trim() : '';
        const value = normalizeSpecificationValue(
          (item as ProductSpecificationItem).value
        );

        if (!label || !value) {
          continue;
        }

        normalized[label] = value;
      }
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

  if (!specifications || typeof specifications !== 'object') {
    return undefined;
  }

  for (const [rawLabel, rawValue] of Object.entries(specifications)) {
    const label = rawLabel.trim();
    const value = normalizeSpecificationValue(rawValue);

    if (!label || !value) {
      continue;
    }

    normalized[label] = value;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeVariantAttributes(source: VariantAttributeSource) {
  const normalizedAttributes: Record<string, string[]> = {};

  if (Array.isArray(source)) {
    const allStrings = source.every(
      (value): value is string => typeof value === 'string'
    );
    if (allStrings) {
      for (const rawAxis of source) {
        const axis = canonicalizeVariantAxis(rawAxis);
        if (!axis || normalizedAttributes[axis]) {
          continue;
        }

        normalizedAttributes[axis] = [];
      }

      return Object.keys(normalizedAttributes).length > 0
        ? normalizedAttributes
        : undefined;
    }

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

export function mergeVariantAttributes(
  source: VariantAttributeSource,
  variants: VariantAttributeCarrier[] | null | undefined
) {
  const normalizedAttributes = normalizeVariantAttributes(source) ?? {};
  const mergedAttributes = new Map<string, Set<string>>();

  for (const [axis, values] of Object.entries(normalizedAttributes)) {
    mergedAttributes.set(axis, new Set(values));
  }

  for (const variant of variants ?? []) {
    for (const [rawAxis, rawValue] of Object.entries(
      variant.attributes ?? {}
    )) {
      const axis = canonicalizeVariantAxis(rawAxis);
      const value = normalizeAttributeValue(rawValue);

      if (!axis || !value) {
        continue;
      }

      const axisValues = mergedAttributes.get(axis) ?? new Set<string>();
      axisValues.add(value);
      mergedAttributes.set(axis, axisValues);
    }
  }

  const result = Object.fromEntries(
    Array.from(mergedAttributes.entries()).map(([axis, values]) => [
      axis,
      Array.from(values),
    ])
  );

  return Object.keys(result).length > 0 ? result : undefined;
}
