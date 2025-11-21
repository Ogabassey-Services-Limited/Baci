
'use server';

import { generateText } from 'ai';
import { geminiFlash } from '@/ai/provider';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { streamToDataURI } from '@/lib/utils';

const EnhanceProductImageInputSchema = z.object({
  photoDataUri: z.string().describe('The product image as a data URI'),
});

export type EnhanceProductImageInput = z.infer<typeof EnhanceProductImageInputSchema>;

const EnhanceProductImageOutputSchema = z.object({
  enhancedPhotoDataUri: z.string(),
});

export type EnhanceProductImageOutput = z.infer<typeof EnhanceProductImageOutputSchema>;

export async function enhanceProductImage(
  input: EnhanceProductImageInput
): Promise<EnhanceProductImageOutput> {
  logger.info('Image enhancement requested.');

  if (!input.photoDataUri) {
    throw new Error('No image provided for enhancement.');
  }

  try {
    const { text, usage, finishReason, toolCalls, toolResults, roundtripData, experimental_streamData } = await generateText({
      model: geminiFlash,
      prompt: `The user has uploaded an image of a product for their e-commerce store. 
      Your task is to professionally enhance this image. 
      Isolate the main product by removing the background and making it transparent. 
      Then, adjust the lighting to be bright and even, as if it were taken in a studio, to ensure the product looks appealing and stands out. 
      Return only the enhanced image.`,
      multimodal: {
        image: [input.photoDataUri],
      },
    });

    if (!experimental_streamData) {
      throw new Error('Image enhancement failed: no stream data returned from AI.');
    }

    const enhancedDataUri = await streamToDataURI(experimental_streamData);

    logger.info('Image enhancement successful.');
    return { enhancedPhotoDataUri: enhancedDataUri };

  } catch (error) {
    logger.error({ message: 'Image enhancement failed', error });
    // In case of failure, return the original image to avoid breaking the UI
    return { enhancedPhotoDataUri: input.photoDataUri };
  }
}
