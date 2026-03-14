import { sanitizeHtml } from '@/lib/sanitize-html';
import type { Product, ProductConditionOffer } from '@/types/product';

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedValues = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return normalizedValues.length > 0 ? normalizedValues : undefined;
}

export function sanitizeOptionalHtml(value: unknown): string | undefined {
  const normalizedValue = normalizeOptionalString(value);
  if (!normalizedValue) {
    return undefined;
  }

  const sanitizedValue = sanitizeHtml(normalizedValue).trim();
  return sanitizedValue.length > 0 ? sanitizedValue : undefined;
}

export function normalizeProductColors(value: unknown): Product['colors'] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedColors: Product['colors'] = [];
  const seenSimpleNames = new Set<string>();
  const seenObjectColors = new Set<string>();

  for (const entry of value) {
    if (typeof entry === 'string') {
      const normalizedName = normalizeOptionalString(entry);
      if (normalizedName && !seenSimpleNames.has(normalizedName)) {
        seenSimpleNames.add(normalizedName);
        normalizedColors.push(normalizedName);
      }
      continue;
    }

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }

    const normalizedName = normalizeOptionalString(
      (entry as { name?: unknown }).name
    );
    if (!normalizedName) {
      continue;
    }

    const normalizedValue = normalizeOptionalString(
      (entry as { value?: unknown }).value
    );

    if (normalizedValue) {
      const colorKey = `${normalizedName}|${normalizedValue}`;
      if (!seenObjectColors.has(colorKey)) {
        seenObjectColors.add(colorKey);
        normalizedColors.push({ name: normalizedName, value: normalizedValue });
      }
      continue;
    }

    if (!seenSimpleNames.has(normalizedName)) {
      seenSimpleNames.add(normalizedName);
      normalizedColors.push(normalizedName);
    }
  }

  return normalizedColors.length > 0 ? normalizedColors : undefined;
}

export function normalizeColorImages(
  value: unknown
): Product['color_images'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const normalizedColorImages: Record<string, string[]> = {};

  for (const [rawColor, rawImages] of Object.entries(value)) {
    const normalizedColor = normalizeOptionalString(rawColor);
    const normalizedImages = normalizeStringArray(rawImages);

    if (!normalizedColor || !normalizedImages) {
      continue;
    }

    const existingImages = normalizedColorImages[normalizedColor] || [];
    normalizedColorImages[normalizedColor] = Array.from(
      new Set([...existingImages, ...normalizedImages])
    );
  }

  return Object.keys(normalizedColorImages).length > 0
    ? normalizedColorImages
    : undefined;
}

export function normalizeSpecifications(
  value: unknown
): Product['specifications'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const normalizedSpecifications: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(value)) {
    const normalizedKey = normalizeOptionalString(rawKey);
    const normalizedValue = normalizeOptionalString(rawValue);

    if (!normalizedKey || !normalizedValue) {
      continue;
    }

    normalizedSpecifications[normalizedKey] = normalizedValue;
  }

  return Object.keys(normalizedSpecifications).length > 0
    ? normalizedSpecifications
    : undefined;
}

export function sanitizeConditionNotes(
  value: unknown
): ProductConditionOffer['condition_notes'] | undefined {
  return sanitizeOptionalHtml(value);
}
