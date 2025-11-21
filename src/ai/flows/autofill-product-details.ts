
'use server';

import { generateObject } from 'ai';
import { geminiFlash } from '@/ai/provider';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const AutofillProductDetailsInputSchema = z.object({
  productName: z.string().describe("The name of the product to generate details for."),
  businessType: z.string().describe("The merchant's business category (e.g., 'fashion', 'electronics')."),
  currencyCode: z.string().describe("The ISO 4217 currency code for pricing (e.g., 'NGN', 'USD')."),
  existingCategories: z.array(z.string()).describe("A list of existing product categories for the merchant's store."),
});

export type AutofillProductDetailsInput = z.infer<typeof AutofillProductDetailsInputSchema>;

const ProductDetailsSchema = z.object({
    description: z.string().describe("A compelling, concise product description (2-3 sentences)."),
    price: z.number().describe("A suggested retail price for the product in the specified currency. It should be a realistic market price."),
    category: z.string().describe("The most suitable category for the product from the provided list."),
    brand: z.string().describe("The brand of the product. This could be the merchant's own brand or a popular brand if applicable."),
});

const AutofillProductDetailsOutputSchema = z.object({
  details: ProductDetailsSchema,
});

export type AutofillProductDetailsOutput = z.infer<typeof AutofillProductDetailsOutputSchema>;

export async function autofillProductDetails(
  input: AutofillProductDetailsInput
): Promise<AutofillProductDetailsOutput> {
  const { productName, businessType, currencyCode, existingCategories } = input;

  try {
    const { object } = await generateObject({
      model: geminiFlash,
      schema: ProductDetailsSchema,
      prompt: `
        You are an AI assistant for an e-commerce platform. Your task is to autofill product details based on a product name.

        Product Name: "${productName}"
        Business Type: "${businessType}"
        Currency for Price: ${currencyCode}
        Available Categories: [${existingCategories.join(', ')}]

        Instructions:
        1.  **Description**: Write a compelling and concise product description (2-3 sentences max).
        2.  **Price**: Suggest a realistic market price for this product in ${currencyCode}. The price should be a number, without currency symbols.
        3.  **Category**: Choose the most fitting category from the provided "Available Categories" list.
        4.  **Brand**: Suggest a brand name. If it seems like a generic or handmade item, use the business name or a generic term like "Artisan". If it's a known product (like "iPhone 15"), use the actual brand (like "Apple").

        Return a single, valid JSON object with the keys "description", "price", "category", and "brand".
      `,
    });

    logger.info({ message: 'Product details autofilled successfully', details: object });
    return { details: object };

  } catch (error) {
    logger.error({ message: 'Product autofill generation failed', error });
    throw new Error('Failed to generate product details.');
  }
}
