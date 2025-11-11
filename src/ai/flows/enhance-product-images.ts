
'use server';

/**
 * @fileOverview Product image enhancement AI flow.
 *
 * Enhances product photos by:
 * 1. Removing background (making it transparent)
 * 2. Adjusting lighting to studio quality
 * 3. Making the product stand out professionally
 *
 * Uses Gemini 1.5 Pro Preview model for image-to-image transformation.
 * Automatically called when users upload product images in the product form.
 *
 * @exports
 * - enhanceProductImage - Main flow function
 * - EnhanceProductImageInput - Input type definition
 * - EnhanceProductImageOutput - Output type definition
 */

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const EnhanceProductImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a product, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
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
  try {
    const ai = new GoogleGenAI(process.env.GEMINI_API_KEY as string);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro-preview" });

    const imagePart = {
        inlineData: {
            data: input.photoDataUri.split(',')[1],
            mimeType: input.photoDataUri.split(';')[0].split(':')[1],
        }
    }

    const prompt = 'The user has uploaded an image of a product for their e-commerce store. Your task is to professionally enhance this image. Isolate the main product by removing the background and making it transparent. Then, adjust the lighting to be bright and even, as if it were taken in a studio, to ensure the product looks appealing and stands out. Return only the enhanced image.';
    
    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    
    // Assuming the model returns the image in the first part of the response
    const image = response.candidates?.[0]?.content.parts.find(part => part.inlineData);
    
    if (!image || !image.inlineData) {
        throw new Error('AI did not return an enhanced image.');
    }

    const enhancedPhotoDataUri = `data:${image.inlineData.mimeType};base64,${image.inlineData.data}`;
    
    return { enhancedPhotoDataUri };

  } catch (error) {
    logger.error({ message: 'Image enhancement flow failed', error });
    throw new Error('Failed to enhance product image.');
  }
}
