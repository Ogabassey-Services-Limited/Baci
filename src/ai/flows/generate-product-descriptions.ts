'use server';

import { generateText } from 'ai';
import { geminiFlash } from '@/ai/provider';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const GenerateProductDescriptionInputSchema = z.object({
  productName: z.string(),
  keywords: z.array(z.string()).optional(),
  brandVoice: z.string().optional(),
  targetAudience: z.string().optional(),
  businessType: z.string().optional(),
});

type GenerateProductDescriptionInput = z.infer<typeof GenerateProductDescriptionInputSchema>;

const GenerateProductDescriptionOutputSchema = z.object({
  description: z.string(),
});

type GenerateProductDescriptionOutput = z.infer<typeof GenerateProductDescriptionOutputSchema>;

export async function generateProductDescription(
  input: GenerateProductDescriptionInput
): Promise<GenerateProductDescriptionOutput> {
  try {
    const { productName, keywords, brandVoice, targetAudience, businessType } = input;

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
