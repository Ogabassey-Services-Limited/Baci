'use server';

import { generateText } from 'ai';
import { geminiFlash, withRetry, sanitizePromptInput } from '@/ai/provider';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const GenerateProductDescriptionInputSchema = z.object({
  productName: z.string().min(1).max(200),
  keywords: z.array(z.string().max(50)).max(10).optional(),
  brandVoice: z.string().max(200).optional(),
  targetAudience: z.string().max(200).optional(),
  businessType: z.string().max(100).optional(),
});

type GenerateProductDescriptionInput = z.infer<typeof GenerateProductDescriptionInputSchema>;

const _GenerateProductDescriptionOutputSchema = z.object({
  description: z.string(),
});

type GenerateProductDescriptionOutput = z.infer<typeof _GenerateProductDescriptionOutputSchema>;

export async function generateProductDescription(
  input: GenerateProductDescriptionInput
): Promise<GenerateProductDescriptionOutput> {
  try {
    // Validate and parse input with Zod
    const validatedInput = GenerateProductDescriptionInputSchema.parse(input);

    // Sanitize all user-provided inputs using centralized sanitizer
    const productName = sanitizePromptInput(validatedInput.productName, 200).value;
    const keywords = (validatedInput.keywords ?? [])
      .map((k) => sanitizePromptInput(k, 50).value)
      .slice(0, 10);
    const brandVoice = validatedInput.brandVoice ? sanitizePromptInput(validatedInput.brandVoice, 200).value : undefined;
    const targetAudience = validatedInput.targetAudience ? sanitizePromptInput(validatedInput.targetAudience, 200).value : undefined;
    const businessType = validatedInput.businessType ? sanitizePromptInput(validatedInput.businessType, 100).value : undefined;

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

    // Use retry wrapper for resilience
    const { text } = await withRetry(async () => {
      return await generateText({
        model: geminiFlash,
        prompt,
      });
    });

    if (!text) {
      throw new Error('AI failed to generate a description.');
    }

    return { description: text };
  } catch (error) {
    logger.error({ message: 'Product description generation failed', error });
    throw new Error('Failed to generate product description.');
  }
}
