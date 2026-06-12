import { z } from 'zod';

// Image MIME types the Gemini image pipeline accepts for product photos.
const PRODUCT_IMAGE_DATA_URI_PATTERN =
  /^data:image\/(?:png|jpe?g|webp|heic|heif);base64,/;

// ~8MB of decoded image data once base64's 4/3 overhead is accounted for.
const MAX_PRODUCT_IMAGE_DATA_URI_LENGTH = 11_500_000;

export const enhanceProductImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .max(MAX_PRODUCT_IMAGE_DATA_URI_LENGTH, 'Image is too large to enhance.')
    .regex(
      PRODUCT_IMAGE_DATA_URI_PATTERN,
      'Image must be a base64 data URI (png, jpeg, webp, heic, or heif).'
    ),
});
