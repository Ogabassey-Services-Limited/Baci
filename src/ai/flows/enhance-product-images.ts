'use server';

/**
 * @fileOverview Product image enhancement AI flow.
 *
 * Enhances product photos by:
 * 1. Removing background (making it transparent)
 * 2. Adjusting lighting to studio quality
 * 3. Making the product stand out professionally
 *
 * Uses Gemini 2.5 Flash Image Preview model for image-to-image transformation.
 * Automatically called when users upload product images in the product form.
 *
 * @exports
 * - enhanceProductImage - Main flow function
 * - EnhanceProductImageInput - Input type definition
 * - EnhanceProductImageOutput - Output type definition
 *
 * @aiContext When modifying this flow:
 * 1. DO NOT change input/output schemas without updating callers in product form
 * 2. Prompt is at lines 48-49 - edit here to change enhancement style
 * 3. MUST use responseModalities: ['TEXT', 'IMAGE'] - IMAGE-only won't work
 * 4. Test with various image sizes and formats (JPEG, PNG, WebP)
 * 5. Consider optimization: large data URIs are memory-intensive
 *
 * @knownIssues
 * - Large images cause memory issues due to data URI size
 * - No preview/loading indicator during enhancement (takes 5-15 seconds)
 * - No manual adjustment controls (brightness, contrast, etc.)
 * - Automatic enhancement on upload might not be desired by all users
 *
 * @futureWork
 * - Upload to Firebase Storage first, pass URLs instead of data URIs
 * - Add user controls for enhancement settings
 * - Show preview before applying enhancement
 * - Support batch enhancement for multiple images
 * - Compress images before sending to AI
 *
 * @see /src/app/dashboard/products/add/add-product-form.tsx:90 - Auto-called on image upload
 * @see /src/ai/flows/_AI_README.md for detailed flow documentation
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

/**
 * Enhances product images with AI - removes background and improves lighting
 *
 * @param input - Image enhancement input data
 * @param input.photoDataUri - Product photo as data URI (e.g., data:image/jpeg;base64,...)
 *
 * @returns Promise<EnhanceProductImageOutput>
 * @returns output.enhancedPhotoDataUri - Enhanced product photo with transparent background and studio lighting
 *
 * @throws {Error} When no media is returned from AI model
 * @throws {Error} When AI generation fails
 *
 * @example
 * // In product form, automatically called on image upload
 * const file = event.target.files[0];
 * const reader = new FileReader();
 * reader.onload = async () => {
 *   const dataUri = reader.result as string;
 *
 *   const result = await enhanceProductImage({
 *     photoDataUri: dataUri
 *   });
 *
 *   // Display enhanced version
 *   setEnhancedImage(result.enhancedPhotoDataUri);
 * };
 * reader.readAsDataURL(file);
 *
 * @aiContext
 * - Enhancement includes: background removal (transparent), studio lighting adjustment
 * - Processing takes 5-15 seconds depending on image size
 * - Data URIs can be very large (several MB for high-res images)
 * - Model: gemini-2.5-flash-image-preview (image generation capabilities)
 * - Must use responseModalities: ['TEXT', 'IMAGE'] - IMAGE-only won't work
 * - Product form shows toggle switch to compare original vs enhanced
 */
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
