'use server';

import { generateText } from 'ai';
import { logger } from '@/lib/logger';
import { gemini25FlashImage, withRetry } from '../provider';

interface EnhanceProductImageInput {
  photoDataUri: string;
}

interface EnhanceProductImageOutput {
  enhancedPhotoDataUri: string;
}

/**
 * Enhances a product photo into a professional e-commerce-ready image.
 *
 * Produces an image with a clean white background, studio-quality lighting, accurate vibrant colors, and the product as the clear focal point suitable for online product listings.
 *
 * @param input - The input object containing `photoDataUri`, a data URI of the source image to enhance.
 * @returns An object with `enhancedPhotoDataUri`, a data URI containing the enhanced image.
 * @throws If `input.photoDataUri` is missing or empty.
 * @throws If the AI response does not contain an image.
 * @throws If the enhancement process fails for any other reason.
 */
export async function enhanceProductImage(
  input: EnhanceProductImageInput
): Promise<EnhanceProductImageOutput> {
  logger.info({ message: 'AI product image enhancement requested.' });

  if (!input.photoDataUri) {
    throw new Error('No image provided for enhancement.');
  }

  try {
    const result = await withRetry(async () => {
      return await generateText({
        model: gemini25FlashImage,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Transform this product photo into a professional e-commerce product image.

Requirements:
1. Remove or replace the background with a clean, pure white background
2. Adjust the lighting to be bright, even, and studio-quality
3. Make the product the clear focal point
4. Ensure colors are accurate and vibrant
5. The result should look like a professional product photo you'd see on Amazon or a high-end online store

Generate the enhanced product image.`,
              },
              {
                type: 'image',
                image: input.photoDataUri,
              },
            ],
          },
        ],
        providerOptions: {
          google: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        },
      });
    });

    // Extract enhanced image from response
    const imageFile = result.files?.find(f => f.mediaType?.startsWith('image/'));

    if (!imageFile || !imageFile.base64) {
      logger.error({ message: 'No enhanced image returned from AI', files: result.files });
      throw new Error('AI did not return an enhanced image.');
    }

    const mediaType = imageFile.mediaType || 'image/png';
    const enhancedDataUri = `data:${mediaType};base64,${imageFile.base64}`;

    logger.info({ message: 'Product image enhancement successful' });
    return { enhancedPhotoDataUri: enhancedDataUri };

  } catch (error) {
    logger.error({ message: 'Product image enhancement failed', error });
    throw new Error('Failed to enhance product image. Please try again.');
  }
}