import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { analyzeSEO, type ProductSEO, type SEOSummary } from './seo-analysis';

export async function getSEOStatusForMerchant(
  supabase: SupabaseClient<Database>,
  merchantId: string
): Promise<{ products: ProductSEO[]; summary: SEOSummary | null }> {
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
    return { products: [], summary: null };
  }

  const analysis = products.map((product) => {
    const qualityAnalysis = analyzeSEO(
      product.meta_title || product.name || '',
      product.meta_description || product.description || '',
      product.keywords || [],
      product.name
    );
    return {
      productId: product.id,
      productName: product.name,
      seoScore: qualityAnalysis.score,
      hasTitle: !!product.meta_title,
      hasDescription: !!product.meta_description,
      hasKeywords: Boolean(product.keywords?.length),
      issues: qualityAnalysis.issues,
    };
  });
  const totalProducts = analysis.length;
  const averageSEOScore =
    totalProducts > 0
      ? Math.round(
          analysis.reduce((sum, product) => sum + product.seoScore, 0) /
            totalProducts
        )
      : 0;

  return {
    products: analysis.sort(
      (first, second) => first.seoScore - second.seoScore
    ),
    summary: {
      totalProducts,
      averageSEOScore,
      missingTitle: analysis.filter((product) => !product.hasTitle).length,
      missingDescription: analysis.filter((product) => !product.hasDescription)
        .length,
      missingKeywords: analysis.filter((product) => !product.hasKeywords)
        .length,
      fullyOptimized: analysis.filter((product) => product.seoScore === 100)
        .length,
      needsWork: analysis.filter((product) => product.seoScore < 70).length,
    },
  };
}
