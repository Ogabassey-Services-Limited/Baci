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

export function isCameraLikeCategory(categoryName: string) {
  const normalized = categoryName
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');

  return CAMERA_CATEGORY_NAMES.has(normalized) || normalized.includes('camera');
}
