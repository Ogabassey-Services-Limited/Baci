export type ProductSpecFamily = 'mobile' | 'computer' | 'camera' | 'general';

const CAMERA_CATEGORY_NAMES = new Set([
  'camera',
  'cameras',
  'action cameras',
  'instant cameras',
  'lenses',
  'drones',
  'gimbals',
  'microphones',
  'monitors & transmitters',
  'tripod stands',
  'camera accessories',
  'instant film',
  'memory cards',
]);

const ACCESSORY_CATEGORY_MARKERS = [
  'accessor',
  'accessories',
  'accessory',
  'case',
  'cases',
  'keyboard',
  'charger',
  'cover',
  'stand',
  'cable',
  'adapter',
  'mouse',
  'sleeve',
  'bag',
  'dock',
  'hub',
];

export function isAccessoryLikeCategory(categoryName: string) {
  return ACCESSORY_CATEGORY_MARKERS.some((marker) =>
    new RegExp(`(^|[^a-z])${marker}(s)?([^a-z]|$)`).test(categoryName)
  );
}

export function isCameraLikeCategory(categoryName: string) {
  const normalized = categoryName
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
  return CAMERA_CATEGORY_NAMES.has(normalized) || normalized.includes('camera');
}

export function getProductSpecFamily(
  categoryName: string | null | undefined
): ProductSpecFamily {
  const normalized = categoryName?.trim().toLowerCase() || '';
  const isAccessory = isAccessoryLikeCategory(normalized);

  // Camera families intentionally take precedence over the generic accessory
  // guard. Camera accessories, lenses, drones, and gimbals still need the
  // camera-safe projection rather than mobile/general device fields.
  if (isCameraLikeCategory(normalized)) {
    return 'camera';
  }

  if (
    !isAccessory &&
    (/(^|[^a-z])(cell|iphone|ipad|phone|smartphone|tablet|smartwatch|wearable|watch)(s)?([^a-z]|$)/.test(
      normalized
    ) ||
      normalized.includes('google pixel'))
  ) {
    return 'mobile';
  }

  if (
    !isAccessory &&
    /(^|[^a-z])(laptop|desktop|computer|notebook|macbook)(s)?([^a-z]|$)/.test(
      normalized
    )
  ) {
    return 'computer';
  }

  return 'general';
}
