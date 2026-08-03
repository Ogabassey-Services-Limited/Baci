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

const MOBILE_CATEGORY_PATTERN =
  /(^|[^a-z])(cell|iphone|ipad|phone|smartphone|tablet|smartwatch|wearable|watch)(s)?([^a-z]|$)/;

export function isCameraLikeCategory(categoryName: string) {
  const normalized = categoryName
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');

  const isMobileCategory =
    MOBILE_CATEGORY_PATTERN.test(normalized) ||
    normalized.includes('google pixel');

  return (
    !isMobileCategory &&
    (CAMERA_CATEGORY_NAMES.has(normalized) || normalized.includes('camera'))
  );
}
