// NOT a server action module: the sole caller is the authenticated, rate-limited
// API route `app/api/ai/generate-faq/route.ts`. `server-only` keeps this module
// (and its AI provider key usage) out of client bundles without exposing
// `generateFAQ` as a public server-action endpoint.
import 'server-only';

import z from 'zod';
import { generateObjectWithChain } from '@/ai/generate-object-with-chain';
import { sanitizePromptInput } from '@/ai/provider';
import { getAIPromptContext } from '@/config/business-types';
import { logger } from '@/lib/logger';
import type { FAQItem } from '@/types/faq';

// Input validation schema
const GenerateFAQInputSchema = z.object({
  businessName: z.string().min(1).max(200),
  businessType: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  products: z
    .array(
      z.object({
        name: z.string().max(200),
        category: z.string().max(100).optional(),
        price: z.number().optional(),
      })
    )
    .max(10)
    .optional(),
  customTopics: z.array(z.string().max(100)).max(5).optional(),
});

export type GenerateFAQInput = z.infer<typeof GenerateFAQInputSchema>;

// Output schema for structured generation
const FAQOutputSchema = z.object({
  faqs: z.array(
    z.object({
      question: z
        .string()
        .describe('Clear, concise question customers commonly ask'),
      answer: z
        .string()
        .describe('Helpful, informative answer (2-4 sentences)'),
      category: z
        .enum([
          'Shipping',
          'Payment',
          'Returns',
          'Products',
          'Orders',
          'General',
        ])
        .describe('FAQ category'),
    })
  ),
});

export interface GenerateFAQOutput {
  success: boolean;
  faqs: FAQItem[];
  error?: string;
}

/**
 * Generates FAQ content for a merchant using AI
 *
 * @param input - Merchant information for context
 * @returns Array of FAQ items ready to save
 */
export async function generateFAQ(
  input: GenerateFAQInput
): Promise<GenerateFAQOutput> {
  try {
    // Validate input
    const validatedInput = GenerateFAQInputSchema.parse(input);

    // Sanitize all user inputs
    const businessName = sanitizePromptInput(
      validatedInput.businessName,
      200
    ).value;
    const businessType = validatedInput.businessType
      ? sanitizePromptInput(validatedInput.businessType, 100).value
      : undefined;
    const country = validatedInput.country
      ? sanitizePromptInput(validatedInput.country, 100).value
      : 'Nigeria';
    const description = validatedInput.description
      ? sanitizePromptInput(validatedInput.description, 1000).value
      : undefined;

    // Get AI context for business type
    const aiContext = businessType
      ? getAIPromptContext(businessType)
      : 'general e-commerce';

    // Format product info for prompt
    const productInfo = validatedInput.products?.length
      ? validatedInput.products
          .map(
            (p) =>
              `- ${sanitizePromptInput(p.name, 200).value}${p.category ? ` (${sanitizePromptInput(p.category, 100).value})` : ''}`
          )
          .join('\n')
      : '';

    const prompt = `You are an expert e-commerce FAQ writer. Generate helpful FAQs for a store.

STORE INFORMATION:
- Business Name: ${businessName}
- Business Type: ${aiContext}
- Country: ${country}
${description ? `- Description: ${description}` : ''}
${productInfo ? `\nSAMPLE PRODUCTS:\n${productInfo}` : ''}

REQUIREMENTS:
1. Generate 8-10 FAQs that customers commonly ask
2. Cover these categories: Shipping, Payment, Returns, Products, Orders, General
3. Make answers specific to the business type and location
4. Keep answers concise (2-4 sentences) but helpful
5. Include location-specific info (payment methods, delivery times for ${country})
6. For ${aiContext} businesses, include relevant product-specific questions

Write natural, customer-friendly questions and helpful answers.

Return JSON in exactly this shape (no extra keys, no markdown fences):
{"faqs": [{"question": string, "answer": string, "category": "Shipping" | "Payment" | "Returns" | "Products" | "Orders" | "General"}]}`;

    // Generate FAQs with structured output via the platform provider chain
    // (Cerebras → Groq → Gemini → Gemini-Lite). The chain itself is the
    // retry, so no withRetry wrapper is needed here.
    const result = await generateObjectWithChain({
      schema: FAQOutputSchema,
      prompt,
    });

    if (!result.object?.faqs?.length) {
      throw new Error('AI failed to generate FAQs');
    }

    // Convert to FAQItem format with order
    const faqs: FAQItem[] = result.object.faqs.map((faq, index) => ({
      id: `faq-${Date.now()}-${index}`,
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      order: index,
    }));

    logger.info({
      message: 'FAQ generation successful',
      count: faqs.length,
      businessName,
    });

    return { success: true, faqs };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error({ message: 'FAQ generation failed', error: errorMessage });

    return {
      success: false,
      faqs: [],
      error: `Failed to generate FAQs: ${errorMessage}`,
    };
  }
}
