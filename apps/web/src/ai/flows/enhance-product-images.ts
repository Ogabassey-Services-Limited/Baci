'use server';

import { generateText } from 'ai';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import {
  ensurePermission,
  isMerchantPermissionRedirectError,
} from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import { enhanceProductImageInputSchema } from '@/schemas/ai-enhance-product-image';
import { gemini25FlashImage, withRetry } from '../provider';

interface EnhanceProductImageInput {
  photoDataUri: string;
}

interface EnhanceProductImageOutput {
  enhancedPhotoDataUri: string;
}

async function ensureProductImagePermission(): Promise<void> {
  try {
    await ensurePermission('products', 'create');
  } catch (error) {
    if (isMerchantPermissionRedirectError(error)) {
      throw new Error('You do not have permission to enhance product images.');
    }
    // Unexpected failures (DB outages, bugs) must surface, not be masked as
    // permission denials.
    throw error;
  }
}

/**
 * AI-powered product image enhancement
 * Takes a regular photo and transforms it into a professional e-commerce product image
 * - Removes/cleans background
 * - Adjusts lighting to studio quality
 * - Makes the product look professional and appealing
 */
export async function enhanceProductImage(
  input: EnhanceProductImageInput
): Promise<EnhanceProductImageOutput> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('You must be signed in to enhance product images.');
  }

  const parsedInput = enhanceProductImageInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error('Invalid product image provided for enhancement.');
  }

  await ensureProductImagePermission();

  logger.info({ message: 'AI product image enhancement requested.' });

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
                image: parsedInput.data.photoDataUri,
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
    const imageFile = result.files?.find((f) =>
      f.mediaType?.startsWith('image/')
    );

    if (!imageFile?.base64) {
      logger.error({
        message: 'No enhanced image returned from AI',
        fileCount: result.files?.length ?? 0,
        fileTypes: result.files?.map((f) => f.mediaType) ?? [],
      });
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
