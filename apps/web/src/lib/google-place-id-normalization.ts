const GOOGLE_PLACE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const GOOGLE_PLACE_RESOURCE_PREFIX = 'places/';

export function normalizeGooglePlaceId(
  placeId: string | null | undefined
): string | null {
  if (typeof placeId !== 'string') {
    return null;
  }

  const trimmed = placeId.trim();
  const normalized = trimmed.startsWith(GOOGLE_PLACE_RESOURCE_PREFIX)
    ? trimmed.slice(GOOGLE_PLACE_RESOURCE_PREFIX.length)
    : trimmed;

  return GOOGLE_PLACE_ID_PATTERN.test(normalized) ? normalized : null;
}
