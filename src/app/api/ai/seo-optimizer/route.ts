import { generateText } from 'ai';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { geminiFlash } from '@/ai/provider';
import { createClient } from '@/lib/supabase/server';

/**
 * AI SEO Optimizer API
 *
 * POST - Generate optimized SEO content for products
 *
 * Body:
 * - productIds: string[] (required) - Product IDs to optimize
 * - options: { generateMetaTitle, generateMetaDescription, generateKeywords, analyzeCompetitors }
 */

interface Product {
  id: string;
  name: string;
  description: string;
  category?: string;
  brand?: string;
  price: number;
  meta_title?: string;
  meta_description?: string;
  keywords?: string[];
}

interface SEOOptimization {
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
  const titleHasKeyword = title
    .toLowerCase()
    .includes(focusKeyword.toLowerCase());

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
  const descHasKeyword = description
    .toLowerCase()
    .includes(focusKeyword.toLowerCase());

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

async function generateSEOContent(
  product: Product
): Promise<SEOOptimization['optimized']> {
  const prompt = `You are an expert SEO specialist for Nigerian e-commerce. Generate optimized SEO content for this product:

Product Name: ${product.name}
Description: ${product.description}
Category: ${product.category || 'General'}
Brand: ${product.brand || 'N/A'}
Price: ₦${product.price.toLocaleString()}

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

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Analyze the generated content
    const analysis = analyzeSEO(
      parsed.meta_title,
      parsed.meta_description,
      parsed.keywords,
      parsed.focus_keyword
    );

    return {
      meta_title: parsed.meta_title,
      meta_description: parsed.meta_description,
      keywords: parsed.keywords,
      focus_keyword: parsed.focus_keyword,
      seo_score: analysis.score,
      suggestions: [...(parsed.suggestions || []), ...analysis.suggestions],
    };
  } catch (error) {
    console.error('AI SEO generation error:', error);

    // Fallback to template-based generation
    const focusKeyword = product.category
      ? `${product.category} ${product.name.split(' ')[0]}`
      : product.name.split(' ').slice(0, 2).join(' ');

    const metaTitle =
      `${product.name} | Buy ${product.brand || ''} ${product.category || 'Products'} in Nigeria`.substring(
        0,
        60
      );
    const metaDescription =
      `Shop ${product.name} at the best price in Nigeria. ${product.description.substring(0, 80)}... Order now with fast delivery!`.substring(
        0,
        160
      );

    return {
      meta_title: metaTitle,
      meta_description: metaDescription,
      keywords: [
        product.name.toLowerCase(),
        product.category?.toLowerCase() || 'products',
        product.brand?.toLowerCase() || '',
        'buy online nigeria',
        'best price',
        'fast delivery',
      ].filter(Boolean) as string[],
      focus_keyword: focusKeyword,
      seo_score: 70,
      suggestions: [
        'AI generation failed - using template. Consider manual optimization.',
      ],
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { productIds, options = {} } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'productIds array is required' },
        { status: 400 }
      );
    }

    // Limit batch size
    if (productIds.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 products per batch' },
        { status: 400 }
      );
    }

    // Fetch products
    const { data: products, error } = await supabase
      .from('products')
      .select(
        'id, name, description, category, brand, price, meta_title, meta_description, keywords'
      )
      .eq('merchant_id', merchant.id)
      .in('id', productIds);

    if (error) {
      console.error('Failed to fetch products:', error);
      return NextResponse.json(
        { error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    // Generate SEO for each product
    const optimizations: SEOOptimization[] = [];

    for (const product of products || []) {
      const optimized = await generateSEOContent(product);

      optimizations.push({
        productId: product.id,
        productName: product.name,
        original: {
          meta_title: product.meta_title,
          meta_description: product.meta_description,
          keywords: product.keywords,
        },
        optimized,
      });

      // Auto-apply if requested
      if (options.autoApply) {
        await supabase
          .from('products')
          .update({
            meta_title: optimized.meta_title,
            meta_description: optimized.meta_description,
            keywords: optimized.keywords,
          })
          .eq('id', product.id);
      }
    }

    // Calculate overall stats
    const avgScore =
      optimizations.reduce((sum, o) => sum + o.optimized.seo_score, 0) /
      optimizations.length;
    const productsNeedingWork = optimizations.filter(
      (o) => o.optimized.seo_score < 70
    ).length;

    return NextResponse.json({
      success: true,
      optimizations,
      summary: {
        totalProducts: optimizations.length,
        averageSEOScore: Math.round(avgScore),
        productsNeedingWork,
        applied: options.autoApply || false,
      },
    });
  } catch (error) {
    console.error('SEO optimizer error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Analyze current SEO status for products
 */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Get all active products
    const { data: products } = await supabase
      .from('products')
      .select('id, name, meta_title, meta_description, keywords')
      .eq('merchant_id', merchant.id)
      .eq('status', 'active');

    // Analyze each product
    const analysis = (products || []).map((product) => {
      const hasTitle = !!product.meta_title;
      const hasDescription = !!product.meta_description;
      const hasKeywords = product.keywords && product.keywords.length > 0;

      let score = 0;
      const issues: string[] = [];

      if (hasTitle) {
        score += 30;
        if (product.meta_title.length < 30 || product.meta_title.length > 60) {
          issues.push('Title length not optimal');
        }
      } else {
        issues.push('Missing meta title');
      }

      if (hasDescription) {
        score += 40;
        if (
          product.meta_description.length < 120 ||
          product.meta_description.length > 160
        ) {
          issues.push('Description length not optimal');
        }
      } else {
        issues.push('Missing meta description');
      }

      if (hasKeywords) {
        score += 30;
      } else {
        issues.push('Missing keywords');
      }

      return {
        productId: product.id,
        productName: product.name,
        seoScore: score,
        hasTitle,
        hasDescription,
        hasKeywords,
        issues,
      };
    });

    // Summary stats
    const totalProducts = analysis.length;
    const avgScore =
      totalProducts > 0
        ? Math.round(
            analysis.reduce((sum, a) => sum + a.seoScore, 0) / totalProducts
          )
        : 0;
    const missingTitle = analysis.filter((a) => !a.hasTitle).length;
    const missingDescription = analysis.filter((a) => !a.hasDescription).length;
    const missingKeywords = analysis.filter((a) => !a.hasKeywords).length;

    return NextResponse.json({
      summary: {
        totalProducts,
        averageSEOScore: avgScore,
        missingTitle,
        missingDescription,
        missingKeywords,
        fullyOptimized: analysis.filter((a) => a.seoScore === 100).length,
        needsWork: analysis.filter((a) => a.seoScore < 70).length,
      },
      products: analysis.sort((a, b) => a.seoScore - b.seoScore), // Worst first
    });
  } catch (error) {
    console.error('SEO analysis error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
