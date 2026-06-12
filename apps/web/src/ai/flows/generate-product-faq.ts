// Server-side AI helper. Its only caller is the Node script
// `src/scripts/generate-all-product-faqs.ts`, so it must NOT be a server
// action ('use server' would expose it as a public, unauthenticated RPC
// endpoint). Intentionally NOT importing 'server-only' either: that package
// throws when imported from a plain Node script context.
import { generateObject } from 'ai';
import z from 'zod';
import { activeTextModel, sanitizePromptInput, withRetry } from '@/ai/provider';
import { logger } from '@/lib/logger';
import type { FAQItem } from '@/types/faq';

// Input validation schema
const GenerateProductFAQInputSchema = z.object({
  productName: z.string().min(1).max(200),
  productDescription: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  price: z.number().optional(),
  specifications: z.unknown().optional(),
});

export type GenerateProductFAQInput = z.infer<
  typeof GenerateProductFAQInputSchema
>;

// Output schema for structured generation
const ProductFAQOutputSchema = z.object({
  faqs: z.array(
    z.object({
      question: z
        .string()
        .describe(
          'Specific question about this product that customers commonly ask'
        ),
      answer: z
        .string()
        .describe(
          'Helpful, accurate answer based on product details (1-2 sentences)'
        ),
    })
  ),
});

export interface GenerateProductFAQOutput {
  success: boolean;
  faqs: FAQItem[];
  error?: string;
}

/**
 * Generates product-specific FAQ content using AI
 * Creates 4-6 relevant questions based on product details
 *
 * @param input - Product information for context
 * @returns Array of FAQ items for the product
 */
export async function generateProductFAQ(
  input: GenerateProductFAQInput
): Promise<GenerateProductFAQOutput> {
  try {
    // Validate input
    const validatedInput = GenerateProductFAQInputSchema.parse(input);

    // Sanitize inputs
    const productName = sanitizePromptInput(
      validatedInput.productName,
      200
    ).value;
    const description = validatedInput.productDescription
      ? sanitizePromptInput(validatedInput.productDescription, 2000).value
      : '';
    const category = validatedInput.category
      ? sanitizePromptInput(validatedInput.category, 100).value
      : '';
    const brand = validatedInput.brand
      ? sanitizePromptInput(validatedInput.brand, 100).value
      : '';

    // Format specs for prompt
    let specsText = '';
    if (validatedInput.specifications) {
      const specs = validatedInput.specifications;
      if (Array.isArray(specs)) {
        // Handle array of objects or strings
        specsText = specs
          .slice(0, 10)
          .map((item) => {
            if (typeof item === 'object' && item !== null) {
              return Object.entries(item)
                .map(([k, v]) => `- ${k}: ${v}`)
                .join('\n');
            }
            return `- ${String(item)}`;
          })
          .join('\n');
      } else if (typeof specs === 'object' && specs !== null) {
        // Handle standard record object
        specsText = Object.entries(specs)
          .slice(0, 10)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join('\n');
      }
    }

    const prompt = `Generate 4-6 product-specific FAQs for an e-commerce product.

PRODUCT: ${productName}
${category ? `CATEGORY: ${category}` : ''}
${brand ? `BRAND: ${brand}` : ''}
${validatedInput.price ? `PRICE: $${validatedInput.price}` : ''}
${description ? `DESCRIPTION: ${description}` : ''}
${specsText ? `SPECIFICATIONS:\n${specsText}` : ''}

REQUIREMENTS:
1. Questions should be specific to THIS product, not generic
2. Focus on common customer concerns: compatibility, features, warranty, usage
3. Answers should be factual based on provided info (1-2 sentences)
4. If info is missing, provide helpful general guidance
5. Include questions about:
   - Key features and what makes it special
   - Compatibility or usage requirements
   - What's included/packaging
   - Warranty or support

Write natural questions customers would actually ask.`;

    // Generate FAQs
    const result = await withRetry(async () => {
      return await generateObject({
        model: activeTextModel,
        schema: ProductFAQOutputSchema,
        prompt,
      });
    });

    if (!result.object?.faqs?.length) {
      throw new Error('AI failed to generate product FAQs');
    }

    // Convert to FAQItem format
    const faqs: FAQItem[] = result.object.faqs.map((faq, index) => ({
      id: `pfaq-${Date.now()}-${index}`,
      question: faq.question,
      answer: faq.answer,
      order: index,
    }));

    logger.info({
      message: 'Product FAQ generation successful',
      count: faqs.length,
      productName,
    });

    return { success: true, faqs };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error({
      message: 'Product FAQ generation failed',
      error: errorMessage,
    });

    return {
      success: false,
      faqs: [],
      error: `Failed to generate product FAQs: ${errorMessage}`,
    };
  }
}
