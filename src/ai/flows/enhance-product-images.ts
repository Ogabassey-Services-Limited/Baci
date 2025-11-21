'use server';

import { z } from 'zod';
import { logger } from '@/lib/logger';

const EnhanceProductImageInputSchema = z.object({
  photoDataUri: z.string().describe('The product image as a data URI'),
});

type EnhanceProductImageInput = z.infer<typeof EnhanceProductImageInputSchema>;

const EnhanceProductImageOutputSchema = z.object({
  enhancedPhotoDataUri: z.string(),
});

type EnhanceProductImageOutput = z.infer<typeof EnhanceProductImageOutputSchema>;

export async function enhanceProductImage(
  input: EnhanceProductImageInput
): Promise<EnhanceProductImageOutput> {
  logger.info({ message: 'Image enhancement requested.' });

  if (!input.photoDataUri) {
    throw new Error('No image provided for enhancement.');
  }

  // Gemini 1.5 Flash cannot generate images.
  // Returning original image as fallback.
  logger.info({ message: 'Image enhancement skipped (model capability limitation).' });

  return { enhancedPhotoDataUri: input.photoDataUri };
}
