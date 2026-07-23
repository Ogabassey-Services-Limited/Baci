'use server';

import z from 'zod';
import { generateObjectWithChain } from '@/ai/generate-object-with-chain';
import { sanitizePromptInput } from '@/ai/provider';
import { getCategoryConfigFromBusinessType } from '@/lib/category-configs';
import { logger } from '@/lib/logger';
import {
  ensurePermission,
  isMerchantPermissionRedirectError,
} from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import {
  type AutofillProductDetailsInput,
  AutofillProductDetailsInputSchema,
} from '@/schemas/ai-autofill-product-details';

async function ensureProductCreatePermission(): Promise<boolean> {
  try {
    await ensurePermission('products', 'create');
    return true;
  } catch (error) {
    if (isMerchantPermissionRedirectError(error)) {
      return false;
    }
    throw error;
  }
}

const VariantSuggestionSchema = z.object({
  attribute: z
    .string()
    .describe(
      "The name of the variant attribute, e.g., 'Color', 'Size', 'Storage'."
    ),
  options: z
    .array(z.string())
    .describe(
      "A list of suggested option values for this attribute, e.g., ['Small', 'Medium', 'Large']."
    ),
});

const ProductDetailsSchema = z.object({
  suggestedName: z
    .string()
    .describe(
      "A standardized, professional product name. e.g., 'samsung s24' should become 'Samsung Galaxy S24'."
    ),
  description: z
    .string()
    .describe('A compelling, concise product description (2-3 sentences).'),
  category: z.string().describe('The most suitable category for the product.'),
  brand: z
    .string()
    .describe(
      "The brand of the product. This could be the merchant's own brand or a popular brand if applicable."
    ),
  suggestedVariants: z
    .array(VariantSuggestionSchema)
    .optional()
    .describe(
      'An array of suggested variant attributes and their options, if applicable.'
    ),
});

const _AutofillProductDetailsOutputSchema = z.object({
  details: ProductDetailsSchema,
  metadata: z
    .object({
      inputTruncation: z
        .object({
          productName: z.boolean(),
          businessType: z.boolean(),
        })
        .optional(),
    })
    .optional(),
});

type AutofillProductDetailsOutput = z.infer<
  typeof _AutofillProductDetailsOutputSchema
>;

export async function autofillProductDetails(
  input: AutofillProductDetailsInput
): Promise<AutofillProductDetailsOutput> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('You must be signed in to autofill product details.');
  }

  const parsedInput = AutofillProductDetailsInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error('Invalid product autofill input.');
  }

  const hasPermission = await ensureProductCreatePermission();
  if (!hasPermission) {
    throw new Error('You do not have permission to autofill product details.');
  }

  // Sanitize inputs and collect truncation metadata
  const productNameResult = sanitizePromptInput(
    parsedInput.data.productName,
    200
  );
  const businessTypeResult = sanitizePromptInput(
    parsedInput.data.businessType,
    100
  );

  const productName = productNameResult.value;
  const businessType = businessTypeResult.value;

  const truncationInfo = {
    productName: productNameResult.metadata.wasTruncated,
    businessType: businessTypeResult.metadata.wasTruncated,
  };

  // Log truncation warnings for observability
  if (truncationInfo.productName || truncationInfo.businessType) {
    logger.warn({
      message: 'Input truncation occurred during product autofill',
      truncationInfo,
      details: {
        productName: productNameResult.metadata,
        businessType: businessTypeResult.metadata,
      },
    });
  }

  const categoryConfig = getCategoryConfigFromBusinessType(businessType);

  const possibleVariantAttributesWithLabels =
    categoryConfig.variantAttributes
      ?.map(
        (attr) =>
          `${attr.label}${attr.options ? ` (Options: ${attr.options.join(', ')})` : ''}`
      )
      .join('; ') || 'None';

  const existingCategories = categoryConfig.productCategories || [];

  try {
    const { object } = await generateObjectWithChain({
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

        Return a single, valid JSON object in exactly this shape (no extra keys, no markdown fences):
        {"suggestedName": string, "description": string, "category": string, "brand": string, "suggestedVariants": [{"attribute": string, "options": string[]}]}
      `,
    });

    logger.info({
      message: 'Product details autofilled successfully',
      suggestedName: object.suggestedName,
      category: object.category,
      brand: object.brand,
      variantCount: object.suggestedVariants?.length ?? 0,
    });

    return {
      details: object,
      metadata: {
        inputTruncation: truncationInfo,
      },
    };
  } catch (error) {
    logger.error({ message: 'Product autofill generation failed', error });
    throw new Error('Failed to generate product details.');
  }
}
