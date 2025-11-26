
'use server';

import { generateObject } from 'ai';
import { geminiFlash } from '@/ai/provider';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getCategoryConfigFromBusinessType } from '@/lib/category-configs';

const _AutofillProductDetailsInputSchema = z.object({
  productName: z.string().describe("The name of the product to generate details for."),
  businessType: z.string().describe("The merchant's business category (e.g., 'fashion', 'electronics')."),
});

type AutofillProductDetailsInput = z.infer<typeof _AutofillProductDetailsInputSchema>;

const VariantSuggestionSchema = z.object({
  attribute: z.string().describe("The name of the variant attribute, e.g., 'Color', 'Size', 'Storage'."),
  options: z.array(z.string()).describe("A list of suggested option values for this attribute, e.g., ['Small', 'Medium', 'Large'].")
});

const ProductDetailsSchema = z.object({
  suggestedName: z.string().describe("A standardized, professional product name. e.g., 'samsung s24' should become 'Samsung Galaxy S24'."),
  description: z.string().describe("A compelling, concise product description (2-3 sentences)."),
  category: z.string().describe("The most suitable category for the product."),
  brand: z.string().describe("The brand of the product. This could be the merchant's own brand or a popular brand if applicable."),
  suggestedVariants: z.array(VariantSuggestionSchema).optional().describe("An array of suggested variant attributes and their options, if applicable.")
});

const _AutofillProductDetailsOutputSchema = z.object({
  details: ProductDetailsSchema,
});

type AutofillProductDetailsOutput = z.infer<typeof _AutofillProductDetailsOutputSchema>;

export async function autofillProductDetails(
  input: AutofillProductDetailsInput
): Promise<AutofillProductDetailsOutput> {
  const { productName, businessType } = input;
  const categoryConfig = getCategoryConfigFromBusinessType(businessType);

  const possibleVariantAttributesWithLabels = categoryConfig.variantAttributes?.map(attr =>
    `${attr.label}${attr.options ? ` (Options: ${attr.options.join(', ')})` : ''}`
  ).join('; ') || 'None';

  const existingCategories = categoryConfig.productCategories || [];


  try {
    const { object } = await generateObject({
      model: geminiFlash,
      schema: ProductDetailsSchema,
      prompt: `
        You are an AI assistant for an e-commerce platform. Your task is to autofill product details based on a product name and business type.

        Product Name: "${productName}"
        Business Type: "${businessType}"
        
        Available Categories for this Business Type: [${existingCategories.join(', ')}]
        
        Possible Variant Attributes (with examples): ${possibleVariantAttributesWithLabels}

        Instructions:
        1.  **suggestedName**: Standardize and professionalize the product name. For example, if the user enters "samsung s24", you should suggest "Samsung Galaxy S24".
        2.  **Description**: Write a compelling and concise product description (2-3 sentences max).
        3.  **Category**: Choose the single most fitting category from the provided "Available Categories" list.
        4.  **Brand**: Suggest a brand name. If it seems like a generic or handmade item, use the business name or a generic term like "Artisan". For a known product (e.g., "Apple iPhone 15"), use the actual brand ("Apple").
        5.  **suggestedVariants**: You **must** analyze the product name and suggest relevant variants. For electronics like phones or laptops, you **must** suggest 'Storage Capacity' and 'RAM' if they are listed as possible attributes.
            - The attribute name (e.g., 'RAM', 'Storage Capacity') **MUST EXACTLY MATCH** one of the labels from the "Possible Variant Attributes" list.
            - The suggested options (e.g., '8GB', '256GB') should come from the examples provided for that attribute if available.
            - **Example**: For "iPhone 15 Pro", you must suggest 'Storage Capacity' with options like ['256GB', '512GB'] AND 'Color' with options like ['Natural Titanium', 'Blue Titanium', 'Midnight Black'].
            - **IMPORTANT**: Return **at least three** distinct color options when the "Color" attribute is present.
            - If no variants seem applicable, return an empty array for this field. DO NOT suggest a price.

        Return a single, valid JSON object.
      `,
    });

    logger.info({ message: 'Product details autofilled successfully', details: object });

    // Debug logging for variant suggestions
    if (object.suggestedVariants && object.suggestedVariants.length > 0) {
      logger.info({
        message: 'AI Variant Suggestions Detail',
        suggestions: object.suggestedVariants
      });
    }

    return { details: object };

  } catch (error) {
    logger.error({ message: 'Product autofill generation failed', error });
    throw new Error('Failed to generate product details.');
  }
}
