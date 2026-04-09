import {
  extractProductSearchIds,
  getProductSearchTotalCount,
} from '@baci/shared';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { isValidUuid, sanitizeSearchQuery } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawQuery = searchParams.get('q');
  const merchantId = searchParams.get('merchant_id');
  const limit = Number.parseInt(searchParams.get('limit') || '20', 10);

  if (!rawQuery || !merchantId) {
    return NextResponse.json(
      { error: 'Missing query or merchant_id parameter' },
      { status: 400 }
    );
  }

  // Validate merchantId
  if (!isValidUuid(merchantId)) {
    return NextResponse.json(
      { error: 'Invalid merchant_id format' },
      { status: 400 }
    );
  }

  // Sanitize search query to prevent XSS and SQL injection
  const query = sanitizeSearchQuery(rawQuery);

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: rankedResults, error } = await supabase.rpc(
      'search_products_v2',
      {
        brand_filter: null,
        category_id_filter: null,
        condition_filter: null,
        max_price_filter: null,
        merchant_id_param: merchantId,
        min_price_filter: null,
        min_rating_filter: null,
        parent_only: false,
        result_limit: limit,
        result_offset: 0,
        search_query: query,
        sort_by: 'relevance',
        status_filter: 'active',
        stock_filter: null,
      }
    );

    if (error) throw error;
    const productIds = extractProductSearchIds(rankedResults ?? []);
    const totalCount = getProductSearchTotalCount(rankedResults ?? []);

    // Track search analytics (fire and forget)
    supabase
      .from('search_analytics')
      .insert({
        merchant_id: merchantId,
        search_query: query,
        results_count: productIds.length,
        search_method: 'server',
      })
      .then(() => {
        /* fire and forget */
      });

    // If no results, try to find spelling suggestion
    let didYouMean = null;
    if (productIds.length === 0) {
      const { data: suggestion } = await supabase.rpc(
        'find_product_search_suggestion_v2',
        {
          search_term: query,
          merchant_id_param: merchantId,
        }
      );

      if (suggestion && suggestion.length > 0) {
        didYouMean = suggestion[0].suggested_term;
      }
    }

    return NextResponse.json({
      productIds,
      didYouMean,
      count: totalCount,
      query,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
}
