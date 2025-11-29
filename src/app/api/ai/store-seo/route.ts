import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { generateText } from 'ai';
import { geminiFlash } from '@/ai/provider';

/**
 * AI Store SEO Generator API
 *
 * POST - Generate optimized store description, tagline, and SEO metadata
 *
 * Body:
 * - type: 'description' | 'tagline' | 'all' (default: 'all')
 * - autoApply: boolean (default: false)
 */

interface StoreSEOContent {
  site_description: string;
  site_tagline: string;
  seo_keywords: string[];
  suggestions: string[];
}

async function generateStoreSEO(merchant: {
  business_name: string;
  business_type?: string | null;
  category?: string | null;
  site_description?: string | null;
  site_tagline?: string | null;
}, storeData: {
  productCount: number;
  categories: string[];
  topProducts: string[];
  priceRange?: { min: number; max: number };
}): Promise<StoreSEOContent> {
  const prompt = `You are an expert SEO specialist for e-commerce stores. Generate optimized store SEO content:

Store Information:
- Business Name: ${merchant.business_name}
- Business Type: ${merchant.business_type || merchant.category || 'General Retail'}
- Product Count: ${storeData.productCount}
- Categories: ${storeData.categories.join(', ') || 'Various products'}
- Top Products: ${storeData.topProducts.join(', ') || 'Various items'}
${storeData.priceRange ? `- Price Range: ₦${storeData.priceRange.min.toLocaleString()} - ₦${storeData.priceRange.max.toLocaleString()}` : ''}

Current Description: ${merchant.site_description || 'Not set'}
Current Tagline: ${merchant.site_tagline || 'Not set'}

Generate the following in JSON format:
{
  "site_description": "SEO-optimized store description (150-160 chars). Must include: store name, what they sell, unique value proposition, and call-to-action",
  "site_tagline": "Catchy, memorable tagline (50-70 chars) that captures the brand essence",
  "seo_keywords": ["array", "of", "10-15", "relevant", "keywords"],
  "suggestions": ["array of additional SEO improvement suggestions for the store"]
}

Requirements:
- Description should mention product categories and count if > 50
- Include Nigerian context if appropriate (e.g., "in Nigeria", "fast delivery Lagos")
- Tagline should be unique and memorable, not generic
- Keywords should include business type, categories, and buying intent terms
- Make content compelling and conversion-focused
- Avoid keyword stuffing - keep it natural

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

    return {
      site_description: parsed.site_description?.substring(0, 160) || '',
      site_tagline: parsed.site_tagline?.substring(0, 100) || '',
      seo_keywords: parsed.seo_keywords || [],
      suggestions: parsed.suggestions || [],
    };
  } catch (error) {
    console.error('AI store SEO generation error:', error);

    // Fallback to template-based generation
    const categories = storeData.categories.slice(0, 3).join(', ') || 'quality products';
    const productInfo = storeData.productCount > 50 ? `${storeData.productCount}+ products` : 'curated selection';

    return {
      site_description: `Shop ${categories} at ${merchant.business_name}. Browse our ${productInfo} and enjoy fast delivery. Order now!`.substring(0, 160),
      site_tagline: `${merchant.business_name} - Your ${merchant.business_type || 'Shopping'} Destination`.substring(0, 100),
      seo_keywords: [
        merchant.business_name.toLowerCase(),
        merchant.business_type?.toLowerCase() || 'online store',
        ...storeData.categories.map(c => c.toLowerCase()),
        'buy online',
        'fast delivery',
        'nigeria',
      ].filter(Boolean),
      suggestions: [
        'AI generation had issues - content generated from template',
        'Consider customizing the description to highlight unique selling points',
        'Add your brand story to connect with customers',
      ],
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant with current SEO data
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, business_name, business_type, category, site_description, site_tagline')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const body = await request.json();
    const { type = 'all', autoApply = false } = body;

    // Fetch store data for context
    const [
      { count: productCount },
      { data: categories },
      { data: topProducts },
      { data: priceData }
    ] = await Promise.all([
      supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('status', 'active'),
      supabase
        .from('categories')
        .select('name')
        .eq('merchant_id', merchant.id)
        .order('position')
        .limit(10),
      supabase
        .from('products')
        .select('name')
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .eq('is_featured', true)
        .limit(5),
      supabase
        .from('products')
        .select('base_price')
        .eq('merchant_id', merchant.id)
        .eq('status', 'active')
        .order('base_price', { ascending: true })
    ]);

    // Calculate price range
    let priceRange: { min: number; max: number } | undefined;
    if (priceData && priceData.length > 0) {
      const prices = priceData.map(p => p.base_price).filter(p => p > 0);
      if (prices.length > 0) {
        priceRange = {
          min: Math.min(...prices),
          max: Math.max(...prices),
        };
      }
    }

    const storeData = {
      productCount: productCount || 0,
      categories: categories?.map(c => c.name) || [],
      topProducts: topProducts?.map(p => p.name) || [],
      priceRange,
    };

    // Generate SEO content
    const generated = await generateStoreSEO(merchant, storeData);

    // Prepare update data based on type
    const updateData: Record<string, string> = {};
    const response: Record<string, unknown> = {
      success: true,
      type,
      current: {
        site_description: merchant.site_description,
        site_tagline: merchant.site_tagline,
      },
      generated,
    };

    if (type === 'description' || type === 'all') {
      updateData.site_description = generated.site_description;
    }
    if (type === 'tagline' || type === 'all') {
      updateData.site_tagline = generated.site_tagline;
    }

    // Auto-apply if requested
    if (autoApply && Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('merchants')
        .update(updateData)
        .eq('id', merchant.id);

      if (updateError) {
        console.error('Failed to update merchant:', updateError);
        response.applied = false;
        response.error = 'Failed to save changes';
      } else {
        response.applied = true;
      }
    } else {
      response.applied = false;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Store SEO generator error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get current store SEO status and suggestions
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, business_name, business_type, category, site_title, site_description, site_tagline')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Calculate SEO score
    let score = 0;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check site title
    if (merchant.site_title) {
      score += 20;
      if (merchant.site_title.length < 30) {
        issues.push('Site title is too short');
      } else if (merchant.site_title.length > 60) {
        issues.push('Site title is too long');
      }
    } else {
      issues.push('Missing custom site title');
      suggestions.push('Add a custom site title that includes your brand and main offering');
    }

    // Check site description
    if (merchant.site_description) {
      score += 40;
      if (merchant.site_description.length < 100) {
        issues.push('Site description is too short (should be 150-160 chars)');
        suggestions.push('Expand your meta description to include keywords and a call-to-action');
      } else if (merchant.site_description.length > 160) {
        issues.push('Site description may be truncated in search results (> 160 chars)');
      }
    } else {
      issues.push('Missing site description');
      suggestions.push('Add a meta description that summarizes your store and includes keywords');
    }

    // Check tagline
    if (merchant.site_tagline) {
      score += 20;
    } else {
      issues.push('Missing site tagline');
      suggestions.push('Add a memorable tagline that captures your brand essence');
    }

    // Business type bonus
    if (merchant.business_type || merchant.category) {
      score += 20;
    } else {
      suggestions.push('Set your business type to improve category-based SEO');
    }

    // Get product/category counts for context
    const [{ count: productCount }, { count: categoryCount }] = await Promise.all([
      supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('status', 'active'),
      supabase
        .from('categories')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id),
    ]);

    return NextResponse.json({
      score: Math.min(100, score),
      current: {
        site_title: merchant.site_title,
        site_description: merchant.site_description,
        site_tagline: merchant.site_tagline,
        business_type: merchant.business_type || merchant.category,
      },
      stats: {
        productCount: productCount || 0,
        categoryCount: categoryCount || 0,
      },
      issues,
      suggestions,
    });
  } catch (error) {
    console.error('Store SEO status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
