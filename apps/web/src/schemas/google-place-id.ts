import { z } from 'zod';
import { normalizeGooglePlaceId } from '@/lib/google-place-id-normalization';

export const googlePlaceIdSchema = z
  .string()
  .trim()
  .min(1, 'Place ID is required')
  .transform((value) => normalizeGooglePlaceId(value) ?? '')
  .refine((value) => value.length > 0, {
    error: 'Invalid Place ID format',
  });
