/**
 * Chat Tool Handlers — product recommendations (upsell / cross-sell / accessory).
 *
 * Extracted from chat-tool-handlers.ts to keep that module under the 300-line
 * modularity limit. Fails closed (empty list) when the copilot tenant is
 * unresolvable.
 */

import type {
  ChatToolTenantClient,
  ProductSearchResult,
} from './chat-tool-result-types';
import type { GetRecommendationsParams } from './chat-tools';

export async function getRecommendationsForTenant(
  params: GetRecommendationsParams,
  scoped: ChatToolTenantClient
): Promise<ProductSearchResult[]> {
  const { merchantId, supabase } = scoped;

  try {
    // First get the source product
    const { data: sourceProduct, error: sourceError } = await supabase
      .from('products')
      .select('id, name, price, category, brand')
      .eq('id', params.productId)
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .maybeSingle();

    if (sourceError || !sourceProduct) {
      if (sourceError)
        console.error('[Chat Tools] Source product error:', sourceError);
      return [];
    }

    let query = supabase
      .from('products')
      .select(
        'id, name, price, description, brand, category, images, stock, status'
      )
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .neq('id', params.productId)
      .limit(3);

    if (params.type === 'upsell') {
      // Same category, higher price (10-50% more)
      query = query
        .eq('category', sourceProduct.category)
        .gt('price', sourceProduct.price * 1.1)
        .lt('price', sourceProduct.price * 1.5)
        .order('price', { ascending: true });
    } else if (params.type === 'cross_sell') {
      // Complementary categories
      const complementaryCategories = getComplementaryCategories(
        sourceProduct.category
      );
      query = query
        .in('category', complementaryCategories)
        .order('price', { ascending: false });
    } else {
      // Accessories - same brand, lower price
      query = query
        .eq('brand', sourceProduct.brand)
        .lt('price', sourceProduct.price * 0.3)
        .order('price', { ascending: false });
    }

    const { data, error: recError } = await query;

    if (recError) {
      console.error('[Chat Tools] Recommendations error:', recError);
      return [];
    }

    return (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      brand: p.brand,
      category: p.category,
      image_url:
        Array.isArray(p.images) && p.images[0]?.url ? p.images[0].url : null,
      stock: p.stock,
      status: p.status,
    }));
  } catch (err) {
    console.error('[Chat Tools] Recommendations error:', err);
    return [];
  }
}

// Helper: Get complementary categories
function getComplementaryCategories(category: string | null): string[] {
  const categoryPairs: Record<string, string[]> = {
    Smartphones: ['Accessories', 'Tablets', 'Wearables'],
    Laptops: ['Accessories', 'Monitors', 'Keyboards'],
    Gaming: ['Accessories', 'Monitors', 'Headphones'],
    Tablets: ['Accessories', 'Keyboards', 'Styluses'],
    Audio: ['Accessories', 'Smartphones', 'Wearables'],
  };

  return categoryPairs[category || ''] || ['Accessories'];
}
