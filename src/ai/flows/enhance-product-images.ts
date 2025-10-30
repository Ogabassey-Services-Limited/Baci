'use server';

/**
 * @fileOverview An AI agent to enhance product images by removing the background and adjusting lighting.
 *
 * - enhanceProductImage - A function that enhances a product image.
 * - EnhanceProductImageInput - The input type for the enhanceProductImage function.
 * - EnhanceProductImageOutput - The return type for the enhanceProductImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnhanceProductImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a product, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'." // Corrected the expected format description
    ),
});
export type EnhanceProductImageInput = z.infer<typeof EnhanceProductImageInputSchema>;

const EnhanceProductImageOutputSchema = z.object({
  enhancedPhotoDataUri: z
    .string()
    .describe('The enhanced photo of the product as a data URI.'),
});
export type EnhanceProductImageOutput = z.infer<typeof EnhanceProductImageOutputSchema>;

export async function enhanceProductImage(
  input: EnhanceProductImageInput
): Promise<EnhanceProductImageOutput> {
  return enhanceProductImageFlow(input);
}

const enhanceProductImageFlow = ai.defineFlow(
  {
    name: 'enhanceProductImageFlow',
    inputSchema: EnhanceProductImageInputSchema,
    outputSchema: EnhanceProductImageOutputSchema,
  },
  async input => {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.5-flash-image-preview',
      prompt: [
        {media: {url: input.photoDataUri}},
        {
          text: 'The user has uploaded an image of a product for their e-commerce store. Your task is to professionally enhance this image. Isolate the main product by removing the background and making it transparent. Then, adjust the lighting to be bright and even, as if it were taken in a studio, to ensure the product looks appealing and stands out. Return only the enhanced image.',
        },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // MUST provide both TEXT and IMAGE, IMAGE only won't work
      },
    });
    if (!media) {
      throw new Error('no media returned');
    }
    return {enhancedPhotoDataUri: media.url!};
  }
);
