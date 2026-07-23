'use server';

import z from 'zod';
import { generateObjectWithChain } from '@/ai/generate-object-with-chain';
import { ensurePermission } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';

// Schema for the batch response
const ProductEnrichmentSchema = z.object({
  productName: z.string(),
  description: z
    .string()
    .describe(
      'A compelling, SEO-optimized product description (approx 2 sentences).'
    ),
  sku: z
    .string()
    .describe(
      'A generated SKU (e.g., BRAND-MODEL-SPEC) if one is not obvious, otherwise logical alphanumeric code.'
    ),
  category: z
    .string()
    .describe(
      "The most appropriate product cateogry (e.g. Smartphones, Laptops, Men's Fashion)."
    ),
  attributes: z
    .record(z.string(), z.string())
    .describe(
      'Extracted attributes like RAM, Storage, Color, Screen Size from the name.'
    ),
});

const BatchEnrichmentResponseSchema = z.object({
  results: z.array(ProductEnrichmentSchema),
});

export type EnrichedProduct = z.infer<typeof ProductEnrichmentSchema>;

export async function enrichProductsBatch(
  productNames: string[]
): Promise<EnrichedProduct[]> {
  if (!productNames.length) return [];

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return [];
  }

  try {
    await ensurePermission('products', 'create');
  } catch {
    return [];
  }

  const prompt = `
You are an expert e-commerce catalog manager.
Your task is to ENRICH product data based on their names.

For each product:
1.  **Description**: Write a short, persuasive, SEO-friendly description (2-3 sentences).
2.  **Category**: Infer the best high-level category (e.g. "Smartphones", "Audio", "Shoes").
3.  **Attributes**: Extract structured data (RAM, Storage, Color, etc.) from the name.
    - Example: "iPhone 12 64GB Blue" -> { "Storage": "64GB", "Color": "Blue", "Brand": "Apple", "Model": "iPhone 12" }
4.  **SKU**: Generate a logical SKU if missing. Format: BRAND-KEYWORD-VAR (e.g., APPL-IP12-64BLU).

Products:
${productNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

Respond with ONLY a JSON object of this exact shape:
{
  "results": [
    {
      "productName": "string (must match one input product name exactly)",
      "description": "string",
      "sku": "string",
      "category": "string",
      "attributes": { "RAM": "8GB" }
    }
  ]
}
`;

  try {
    const { object } = await generateObjectWithChain({
      schema: BatchEnrichmentResponseSchema,
      prompt,
    });

    return object.results;
  } catch (error) {
    console.error('Error in enrichProductsBatch:', error);
    return [];
  }
}
