'use server';

import { generateText } from 'ai';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { geminiFlash } from '@/ai/provider';
import { createClient } from '@/lib/supabase/server';

export interface ProductSEO {
  productId: string;
  productName: string;
  seoScore: number;
  hasTitle: boolean;
  hasDescription: boolean;
  hasKeywords: boolean;
  issues: string[];
}

export interface SEOSummary {
  totalProducts: number;
  averageSEOScore: number;
  missingTitle: number;
  missingDescription: number;
  missingKeywords: number;
  fullyOptimized: number;
  needsWork: number;
}

export interface SEOOptimization {
  productId: string;
  productName: string;
  original: {
    meta_title?: string;
    meta_description?: string;
    keywords?: string[];
  };
  optimized: {
    meta_title: string;
    meta_description: string;
    keywords: string[];
    focus_keyword: string;
    seo_score: number;
    suggestions: string[];
  };
}

interface SEOAnalysis {
  title_length: number;
  title_has_keyword: boolean;
  description_length: number;
  description_has_keyword: boolean;
  keyword_count: number;
  score: number;
  issues: string[];
  suggestions: string[];
}

function analyzeSEO(
  title: string,
  description: string,
  keywords: string[],
  focusKeyword: string
): SEOAnalysis {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Title analysis
  const titleLength = title.length;
  // Guard against empty focusKeyword - ''.includes('') returns true incorrectly
  const titleHasKeyword =
    focusKeyword.length > 0 &&
    title.toLowerCase().includes(focusKeyword.toLowerCase());

  if (titleLength < 30) {
    issues.push('Title is too short (< 30 chars)');
    score -= 15;
  } else if (titleLength > 60) {
    issues.push('Title is too long (> 60 chars)');
    score -= 10;
  }

  if (!titleHasKeyword) {
    issues.push('Focus keyword not found in title');
    score -= 20;
    suggestions.push(`Add "${focusKeyword}" to the title`);
  }

  // Description analysis
  const descLength = description.length;
  // Guard against empty focusKeyword - ''.includes('') returns true incorrectly
  const descHasKeyword =
    focusKeyword.length > 0 &&
    description.toLowerCase().includes(focusKeyword.toLowerCase());

  if (descLength < 120) {
    issues.push('Meta description is too short (< 120 chars)');
    score -= 15;
  } else if (descLength > 160) {
    issues.push('Meta description is too long (> 160 chars)');
    score -= 10;
  }

  if (!descHasKeyword) {
    issues.push('Focus keyword not found in description');
    score -= 15;
    suggestions.push(`Include "${focusKeyword}" in the meta description`);
  }

  // Keywords analysis
  if (keywords.length < 3) {
    issues.push('Too few keywords (< 3)');
    score -= 10;
    suggestions.push('Add more relevant keywords');
  } else if (keywords.length > 10) {
    issues.push('Too many keywords (> 10)');
    score -= 5;
  }

  // Additional suggestions
  if (!title.match(/buy|shop|best|top|quality|premium/i)) {
    suggestions.push(
      'Consider adding power words like "Best", "Premium", or "Quality"'
    );
  }

  if (
    !description.includes('₦') &&
    !description.match(/free shipping|discount|sale/i)
  ) {
    suggestions.push(
      'Consider mentioning price or promotions in the description'
    );
  }

  return {
    title_length: titleLength,
    title_has_keyword: titleHasKeyword,
    description_length: descLength,
    description_has_keyword: descHasKeyword,
    keyword_count: keywords.length,
    score: Math.max(0, score),
    issues,
    suggestions,
  };
}

export async function getSEOStatus(merchantId: string): Promise<{
  products: ProductSEO[];
  summary: SEOSummary | null;
}> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: products, error } = await supabase
    .from('products')
    .select(
      'id, name, description, meta_title, meta_description, keywords, category, brand, price'
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching products for SEO status:', error);
    throw new Error('Failed to fetch products');
  }

  if (!products) {
    return {
      products: [],
      summary: null,
    };
  }

  const analysis = products.map((product) => {
    // Determine effective content (what Google actually sees)
    const effectiveTitle = product.meta_title || product.name || '';
    const effectiveDescription =
      product.meta_description || product.description || '';

    const hasCustomTitle = !!product.meta_title;
    const hasCustomDescription = !!product.meta_description;
    const hasKeywords = product.keywords && product.keywords.length > 0;

    // reuse the helper function for consistent scoring
    const qualityAnalysis = analyzeSEO(
      effectiveTitle,
      effectiveDescription,
      product.keywords || [],
      product.name // Use product name as proxy for focus keyword for basic analysis
    );

    return {
      productId: product.id,
      productName: product.name,
      seoScore: qualityAnalysis.score,
      hasTitle: hasCustomTitle,
      hasDescription: hasCustomDescription,
      hasKeywords,
      issues: qualityAnalysis.issues,
    };
  });

  const totalProducts = analysis.length;
  const avgScore =
    totalProducts > 0
      ? Math.round(
          analysis.reduce((sum, a) => sum + a.seoScore, 0) / totalProducts
        )
      : 0;

  return {
    products: analysis.sort((a, b) => a.seoScore - b.seoScore),
    summary: {
      totalProducts,
      averageSEOScore: avgScore,
      missingTitle: analysis.filter((a) => !a.hasTitle).length,
      missingDescription: analysis.filter((a) => !a.hasDescription).length,
      missingKeywords: analysis.filter((a) => !a.hasKeywords).length,
      fullyOptimized: analysis.filter((a) => a.seoScore === 100).length,
      needsWork: analysis.filter((a) => a.seoScore < 70).length,
    },
  };
}

export async function generateSEOSuggestions(
  merchantId: string,
  productIds: string[]
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  if (productIds.length > 20) {
    throw new Error('Maximum 20 products per batch');
  }

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
    const prompt = `You are an expert SEO specialist for Nigerian e-commerce. Generate optimized SEO content for this product:

Product Name: ${product.name}
Description: ${product.description}
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

    try {
      const { text: response } = await generateText({
        model: geminiFlash,
        prompt,
      });

      // Try to parse the response directly, or extract JSON if wrapped
      let parsed: {
        meta_title: string;
        meta_description: string;
        keywords: string[];
        focus_keyword: string;
        suggestions?: string[];
      };
      try {
        parsed = JSON.parse(response);
      } catch {
        // Extract JSON from markdown or text wrapper
        const jsonMatch =
          response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
          response.match(/(\{[\s\S]*\})/);
        if (!jsonMatch) {
          throw new Error('Invalid JSON response');
        }
        parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }

      // Analyze the generated content
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
          meta_title: product.meta_title,
          meta_description: product.meta_description,
          keywords: product.keywords,
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
      console.error(`Error generating SEO for ${product.name}:`, error);
      // Skip this product or provide limited fallback?
      // For now, easier to skip or throw partial error, but let's just skip to keep logic simple without crashing entire batch
    }
  }

  return optimizations;
}

export async function saveSEOSettings(
  merchantId: string,
  optimizations: {
    productId: string;
    meta_title: string;
    meta_description: string;
    keywords: string[];
  }[]
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Validate ownership first (though RLS should handle it, explicit check is good)
  // For batch updates, execute all and check for errors
  const results = await Promise.all(
    optimizations.map(
      (opt) =>
        supabase
          .from('products')
          .update({
            meta_title: opt.meta_title,
            meta_description: opt.meta_description,
            keywords: opt.keywords,
          })
          .eq('id', opt.productId)
          .eq('merchant_id', merchantId) // Safety check
    )
  );

  // Check for errors in batch updates
  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    console.error('Failed to update some products:', errors);
    throw new Error(`Failed to update ${errors.length} product(s)`);
  }

  revalidatePath('/dashboard/seo');
  return { success: true };
}
