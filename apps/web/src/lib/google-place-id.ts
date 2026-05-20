import { z } from 'zod';

const GOOGLE_PLACE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export const googlePlaceIdSchema = z
  .string()
  .trim()
  .min(1, 'Place ID is required')
  .transform((value) =>
    value.startsWith('places/') ? value.slice('places/'.length) : value
  )
  .refine((value) => GOOGLE_PLACE_ID_PATTERN.test(value), {
    message: 'Invalid Place ID format',
  });

export function normalizeGooglePlaceId(
  placeId: string | null | undefined
): string | null {
  if (typeof placeId !== 'string') {
    return null;
  }

  const result = googlePlaceIdSchema.safeParse(placeId);

  return result.success ? result.data : null;
}
