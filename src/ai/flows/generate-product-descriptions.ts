
'use server';

/**
 * @fileOverview Product description generation AI flow.
 *
 * Generates compelling, business-type-aware product descriptions using AI.
 * The description style automatically adapts based on the business category
 * (e.g., technical for electronics, aspirational for fashion, story-driven for handmade).
 *
 * Uses Gemini 1.5 Flash (text-only model) for fast, cost-effective generation.
 *
 * @exports
 * - generateProductDescription - Main flow function
 * - GenerateProductDescriptionInput - Input type definition
 * - GenerateProductDescriptionOutput - Output type definition
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getBusinessTypeById } from '@/config/business-types';
import { logger } from '@/lib/logger';

const GenerateProductDescriptionInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  businessType: z.string().describe('The type of business selling the product.'),
  productDetails: z.string().describe('Detailed information about the product.'),
});
export type GenerateProductDescriptionInput = z.infer<typeof GenerateProductDescriptionInputSchema>;

const GenerateProductDescriptionOutputSchema = z.object({
  description: z.string().describe('A compelling product description.'),
});
export type GenerateProductDescriptionOutput = z.infer<typeof GenerateProductDescriptionOutputSchema>;

async function generateProductDescriptionFlow(
  input: GenerateProductDescriptionInput
): Promise<GenerateProductDescriptionOutput> {
  try {
    const businessTypeConfig = getBusinessTypeById(input.businessType);
    const styleGuidance = businessTypeConfig
      ? businessTypeConfig.journey.productCreation.aiDescriptionStyle
      : 'general, informative product description';
    const businessContext = businessTypeConfig
      ? businessTypeConfig.aiPromptContext
      : 'general e-commerce';

    const prompt = `You are an expert copywriter specializing in e-commerce product descriptions.

You will generate a compelling product description based on the provided information, taking into account the business type and style guidance.

Product Name: ${input.productName}
Business Type: ${input.businessType}
Product Details: ${input.productDetails}

STYLE GUIDANCE: ${styleGuidance}
BUSINESS CONTEXT: ${businessContext}

Write a product description that is engaging, informative, and persuasive. Follow the style guidance to ensure the description matches the business type and target audience. Return only the description text, with no extra formatting or labels.`;

    const { text } = await ai.generate({ prompt });

    if (!text) {
      throw new Error('AI failed to generate a description.');
    }

    return { description: text };
  } catch (error) {
    logger.error({ message: 'Product description generation failed', error });
    throw new Error('Failed to generate product description.');
  }
}

export async function generateProductDescription(
  input: GenerateProductDescriptionInput
): Promise<GenerateProductDescriptionOutput> {
    return generateProductDescriptionFlow(input);
}
