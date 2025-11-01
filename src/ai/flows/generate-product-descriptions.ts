'use server';

/**
 * @fileOverview Product description generation AI flow.
 *
 * Generates compelling, business-type-aware product descriptions using AI.
 * The description style automatically adapts based on the business category
 * (e.g., technical for electronics, aspirational for fashion, story-driven for handmade).
 *
 * Uses Gemini 2.5 Flash (text-only model) for fast, cost-effective generation.
 *
 * @exports
 * - generateProductDescription - Main flow function
 * - GenerateProductDescriptionInput - Input type definition
 * - GenerateProductDescriptionOutput - Output type definition
 *
 * @aiContext When modifying this flow:
 * 1. DO NOT change input/output schemas without updating callers in product form
 * 2. Prompt is at lines 99-114 - edit here to change base description style
 * 3. Business type context is critical - test with all 6 business types
 * 4. ✅ Phase 3 COMPLETE: Now reads from business type config for style guidance
 * 5. Future (Phase 4): Replace hardcoded "Handmade & Crafts" in product form with user's actual business type
 *
 * @knownIssues
 * - Product form hardcodes businessType to "Handmade & Crafts" (see add-product-form.tsx:122) - Phase 4
 * - No tone customization (casual, professional, playful)
 * - No length options (short, medium, long)
 *
 * @phase3Changes
 * - ✅ Imports business type config helper functions
 * - ✅ Flow reads aiDescriptionStyle from config
 * - ✅ Flow reads aiPromptContext from config
 * - ✅ Enhanced prompt includes style guidance and business context
 * - ✅ Fallback to generic style if business type not found
 *
 * @see /src/app/dashboard/products/add/add-product-form.tsx:119 - Caller
 * @see /src/ai/flows/_AI_README.md for detailed flow documentation
 * @see /src/config/business-types.ts for business type definitions
 * @see /docs/adr/001-business-type-journey-architecture.md for architecture
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getBusinessTypeById } from '@/config/business-types';

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

/**
 * Generates AI-powered product descriptions tailored to business type
 *
 * @param input - Product description input data
 * @param input.productName - Name of the product (e.g., "Handmade Ceramic Mug")
 * @param input.businessType - Business category (e.g., "fashion", "electronics", "handmade")
 * @param input.productDetails - Additional product information (e.g., materials, features, specifications)
 *
 * @returns Promise<GenerateProductDescriptionOutput>
 * @returns output.description - AI-generated product description (engaging, informative, persuasive)
 *
 * @throws {Error} When AI generation fails
 *
 * @example
 * const result = await generateProductDescription({
 *   productName: 'Handmade Ceramic Mug',
 *   businessType: 'handmade',
 *   productDetails: 'Blue glaze, 12oz capacity, dishwasher safe, made from local clay'
 * });
 *
 * console.log(result.description);
 * // "This beautiful handmade ceramic mug brings artisan craftsmanship to your
 * // daily coffee ritual. Each piece is lovingly crafted from locally-sourced clay
 * // and finished with a stunning blue glaze that catches the light..."
 *
 * @aiContext
 * - ✅ Business type automatically influences description style via config:
 *   - Flow reads from /src/config/business-types.ts
 *   - Style guidance: businessTypeConfig.journey.productCreation.aiDescriptionStyle
 *   - Business context: businessTypeConfig.aiPromptContext
 * - Examples from config:
 *   - Fashion: "aspirational, lifestyle-focused, emphasizes style and fit"
 *   - Electronics: "feature-focused, technical, highlights specifications and capabilities"
 *   - Handmade: "story-focused, emphasizes craftsmanship and uniqueness, personal touch"
 *   - Health & Beauty: "benefit-focused, emphasizes results and ingredients, addresses concerns"
 *   - Home Goods: "lifestyle-focused, emphasizes comfort and aesthetics, how it fits in a home"
 *   - Food & Beverage: "sensory-focused, emphasizes taste and quality, ingredients and origin"
 * - Product details should be specific and rich for best results
 * - AI model is text-only (gemini-2.5-flash), fast and cost-effective
 */
export async function generateProductDescription(
  input: GenerateProductDescriptionInput
): Promise<GenerateProductDescriptionOutput> {
  return generateProductDescriptionFlow(input);
}

const EnhancedInputSchema = GenerateProductDescriptionInputSchema.extend({
  styleGuidance: z.string().describe('AI description style guidance from business type config'),
  businessContext: z.string().describe('Business context from config'),
});

const prompt = ai.definePrompt({
  name: 'generateProductDescriptionPrompt',
  input: {schema: EnhancedInputSchema},
  output: {schema: GenerateProductDescriptionOutputSchema},
  prompt: `You are an expert copywriter specializing in e-commerce product descriptions.

You will generate a compelling product description based on the provided information, taking into account the business type and style guidance.

Product Name: {{{productName}}}
Business Type: {{{businessType}}}
Product Details: {{{productDetails}}}

STYLE GUIDANCE: {{{styleGuidance}}}
BUSINESS CONTEXT: {{{businessContext}}}

Write a product description that is engaging, informative, and persuasive. Follow the style guidance to ensure the description matches the business type and target audience.`,
});

const generateProductDescriptionFlow = ai.defineFlow(
  {
    name: 'generateProductDescriptionFlow',
    inputSchema: GenerateProductDescriptionInputSchema,
    outputSchema: GenerateProductDescriptionOutputSchema,
  },
  async input => {
    // Get business type config for enhanced prompt guidance
    const businessTypeConfig = getBusinessTypeById(input.businessType);

    // Get style guidance from config, or use generic if not found
    const styleGuidance = businessTypeConfig
      ? businessTypeConfig.journey.productCreation.aiDescriptionStyle
      : 'general, informative product description';

    const businessContext = businessTypeConfig
      ? businessTypeConfig.aiPromptContext
      : 'general e-commerce';

    // Call prompt with enhanced input
    const {output} = await prompt({
      ...input,
      styleGuidance,
      businessContext,
    });

    return output!;
  }
);
