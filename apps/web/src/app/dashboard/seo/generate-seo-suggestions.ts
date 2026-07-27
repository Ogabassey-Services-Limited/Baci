import type { SupabaseClient } from '@supabase/supabase-js';
import { generateTextWithChain } from '@/ai/generate-text-with-chain';
import { generatedSEOContentSchema } from '@/schemas/generated-seo-content';
import type { Database } from '@/types/supabase';
import { analyzeSEO, type SEOOptimization } from './seo-analysis';

function parseGeneratedSEOContent(response: string) {
  let parsedResponse: unknown;
  try {
    parsedResponse = JSON.parse(response);
  } catch {
    const jsonMatch =
      response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
      response.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response');
    }
    parsedResponse = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  }

  const parsed = generatedSEOContentSchema.safeParse(parsedResponse);
  if (!parsed.success) {
    throw new Error('Invalid generated SEO response');
  }
  return parsed.data;
}

function buildSEOGenerationPrompt(product: {
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  price: number | null;
}): string {
  return `You are an expert SEO specialist for Nigerian e-commerce. Generate optimized SEO content for this product:

Product Name: ${product.name}
Description: ${product.description ?? 'No description provided'}
Category: ${product.category || 'General'}
Brand: ${product.brand || 'N/A'}
Price: ${product.price ? `₦${product.price.toLocaleString()}` : 'Contact for price'}

Generate the following in JSON format:
{
  "meta_title": "SEO-optimized title (50-60 chars, include primary keyword)",
  "meta_description": "Compelling meta description (150-160 chars, include CTA and keyword)",
  "keywords": ["array", "of", "relevant", "keywords", "5-8 keywords"],
  "focus_keyword": "primary keyword phrase",
  "suggestions": ["array of SEO improvement suggestions"]
}

Requirements:
- Meta title should be compelling and include the product type
- Meta description should have a call-to-action (Buy, Shop, Order)
- Keywords should include Nigerian shopping terms
- Focus on Nigerian e-commerce SEO best practices
- Include brand if available
- Make it natural and not keyword-stuffed

Return ONLY valid JSON, no markdown or explanation.`;
}

export async function generateSEOSuggestionsForMerchant(
  supabase: SupabaseClient<Database>,
  merchantId: string,
  productIds: string[]
): Promise<SEOOptimization[]> {
  const { data: products, error } = await supabase
    .from('products')
    .select(
      'id, name, description, category, brand, price, meta_title, meta_description, keywords'
    )
    .eq('merchant_id', merchantId)
    .in('id', productIds);
  if (error) {
    console.error('Error fetching products for SEO generation:', error);
    throw new Error('Failed to fetch products');
  }
  if (!products || products.length === 0) {
    throw new Error('No products found');
  }

  const optimizations: SEOOptimization[] = [];
  for (const product of products) {
    try {
      const { text: response } = await generateTextWithChain({
        prompt: buildSEOGenerationPrompt(product),
      });
      const parsed = parseGeneratedSEOContent(response);
      const analysis = analyzeSEO(
        parsed.meta_title,
        parsed.meta_description,
        parsed.keywords,
        parsed.focus_keyword
      );
      optimizations.push({
        productId: product.id,
        productName: product.name,
        original: {
          meta_title: product.meta_title ?? undefined,
          meta_description: product.meta_description ?? undefined,
          keywords: product.keywords ?? undefined,
        },
        optimized: {
          meta_title: parsed.meta_title,
          meta_description: parsed.meta_description,
          keywords: parsed.keywords,
          focus_keyword: parsed.focus_keyword,
          seo_score: analysis.score,
          suggestions: [...(parsed.suggestions || []), ...analysis.suggestions],
        },
      });
    } catch (error) {
      console.error('Error generating SEO for product:', product.name, error);
    }
  }
  return optimizations;
}
