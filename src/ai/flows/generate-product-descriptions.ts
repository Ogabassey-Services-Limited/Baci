'use server';

import { generateText } from 'ai';
import { geminiFlash } from '@/ai/provider';
import { z } from 'zod';
import { logger } from '@/lib/logger';

/**
 * Sanitize input for AI prompts to prevent prompt injection attacks.
 * Removes potential control sequences and limits length.
 */
function sanitizeAIInput(input: string, maxLength: number = 200): string {
  if (!input) return '';

  // Remove potential prompt injection patterns
  let sanitized = input
    // Remove common prompt injection patterns
    .replace(/ignore (previous|all|above|prior) (instructions?|prompts?)/gi, '')
    .replace(/disregard (previous|all|above|prior)/gi, '')
    .replace(/forget (everything|all|previous)/gi, '')
    .replace(/new instructions?:/gi, '')
    .replace(/system:/gi, '')
    .replace(/assistant:/gi, '')
    .replace(/user:/gi, '')
    // Remove markdown/formatting that could affect prompt
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

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

    // Sanitize all user-provided inputs
    const productName = sanitizeAIInput(validatedInput.productName, 200);
    const keywords = validatedInput.keywords?.map((k: string) => sanitizeAIInput(k, 50)).slice(0, 10);
    const brandVoice = validatedInput.brandVoice ? sanitizeAIInput(validatedInput.brandVoice, 200) : undefined;
    const targetAudience = validatedInput.targetAudience ? sanitizeAIInput(validatedInput.targetAudience, 200) : undefined;
    const businessType = validatedInput.businessType ? sanitizeAIInput(validatedInput.businessType, 100) : undefined;

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

    const { text } = await generateText({
      model: geminiFlash,
      prompt,
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
