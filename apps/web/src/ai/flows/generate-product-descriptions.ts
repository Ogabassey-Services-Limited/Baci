'use server';

import { cookies } from 'next/headers';
import { generateTextWithChain } from '@/ai/generate-text-with-chain';
import { sanitizePromptInput } from '@/ai/provider';
import { logger } from '@/lib/logger';
import {
  ensurePermission,
  isMerchantPermissionRedirectError,
} from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import {
  type GenerateProductDescriptionInput,
  generateProductDescriptionInputSchema,
} from '@/schemas/ai-generate-product-description';

type GenerateProductDescriptionOutput = {
  description: string;
};

/**
 * Require `products.create` access for the session merchant. Expected
 * permission failures become a stable, user-safe error; unexpected errors
 * (DB outages, bugs) are rethrown so incidents are never masked.
 */
async function ensureProductCreatePermission(): Promise<void> {
  try {
    await ensurePermission('products', 'create');
  } catch (error) {
    if (isMerchantPermissionRedirectError(error)) {
      throw new Error(
        'You do not have permission to generate product descriptions.'
      );
    }
    throw error;
  }
}

export async function generateProductDescription(
  input: GenerateProductDescriptionInput
): Promise<GenerateProductDescriptionOutput> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('You must be signed in to generate product descriptions.');
  }

  // Validate and parse input with Zod
  const parsed = generateProductDescriptionInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error('Invalid product description request.');
  }

  await ensureProductCreatePermission();

  const validatedInput = parsed.data;

  try {
    // Sanitize all user-provided inputs using centralized sanitizer
    const productName = sanitizePromptInput(
      validatedInput.productName,
      200
    ).value;
    const keywords = (validatedInput.keywords ?? [])
      .map((k) => sanitizePromptInput(k, 50).value)
      .slice(0, 10);
    const brandVoice = validatedInput.brandVoice
      ? sanitizePromptInput(validatedInput.brandVoice, 200).value
      : undefined;
    const targetAudience = validatedInput.targetAudience
      ? sanitizePromptInput(validatedInput.targetAudience, 200).value
      : undefined;
    const businessType = validatedInput.businessType
      ? sanitizePromptInput(validatedInput.businessType, 100).value
      : undefined;

    if (!productName) {
      throw new Error('Product name is required');
    }

    const prompt = `
You are an expert copywriter for an e-commerce store.
Product Name: ${productName}
${keywords?.length ? `Keywords: ${keywords.join(', ')}` : ''}
${brandVoice ? `Brand Voice: ${brandVoice}` : ''}
${targetAudience ? `Target Audience: ${targetAudience}` : ''}
${businessType ? `Business Type: ${businessType}` : ''}

Write a product description that is engaging, informative, and persuasive. Follow the style guidance to ensure the description matches the business type and target audience. Return only the description text, with no extra formatting or labels.`;

    // The provider chain (Cerebras → Groq → Gemini → Gemini-Lite) is the
    // retry: each provider gets exactly one attempt before falling through.
    const { text } = await generateTextWithChain({ prompt });

    if (!text) {
      throw new Error('AI failed to generate a description.');
    }

    return { description: text };
  } catch (error) {
    logger.error({ message: 'Product description generation failed', error });
    throw new Error('Failed to generate product description.');
  }
}
