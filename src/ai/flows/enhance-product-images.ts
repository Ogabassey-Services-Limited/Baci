'use server';

import { generateObject } from 'ai';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { geminiFlashImage, withRetry } from '../provider';

const _EnhanceProductImageInputSchema = z.object({
  photoDataUri: z.string().describe('The product image as a data URI'),
});

type EnhanceProductImageInput = z.infer<typeof _EnhanceProductImageInputSchema>;

const EnhanceProductImageOutputSchema = z.object({
  enhancedPhotoDataUri: z.string(),
});

type EnhanceProductImageOutput = z.infer<typeof EnhanceProductImageOutputSchema>;

const ENHANCE_PRODUCT_IMAGE_PROMPT = `
The user has uploaded an image of a product for their e-commerce store.
Your task is to professionally enhance this image.
Isolate the main product by removing the background and making it transparent.
Then, adjust the lighting to be bright and even, as if it were taken in a studio, to ensure the product looks appealing and stands out.
Return only the enhanced image.
`;

export async function enhanceProductImage(
  input: EnhanceProductImageInput
): Promise<EnhanceProductImageOutput> {
  logger.info({ message: 'Image enhancement requested.' });

  if (!input.photoDataUri) {
    throw new Error('No image provided for enhancement.');
  }

  try {
    const { object: enhancedImage } = await withRetry(async () => {
      return await generateObject({
        model: geminiFlashImage,
        schema: EnhanceProductImageOutputSchema,
        prompt: ENHANCE_PRODUCT_IMAGE_PROMPT,
      });
    });

    if (!enhancedImage.enhancedPhotoDataUri) {
      throw new Error('AI did not return an enhanced image.');
    }

    return { enhancedPhotoDataUri: enhancedImage.enhancedPhotoDataUri };
  } catch (error) {
    logger.error({ message: 'Image enhancement failed', error });
    // As a fallback, return the original image so the UI doesn't break.
    return { enhancedPhotoDataUri: input.photoDataUri };
  }
}
