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

    // Use smart search function
    const { data: results, error } = await supabase.rpc(
      'smart_product_search',
      {
        search_query: query,
        merchant_id_param: merchantId,
        result_limit: limit,
      }
    );

    if (error) throw error;

    // Track search analytics (fire and forget)
    supabase
      .from('search_analytics')
      .insert({
        merchant_id: merchantId,
        search_query: query,
        results_count: results?.length || 0,
        search_method: 'server',
      })
      .then(() => {
        /* fire and forget */
      });

    // If no results, try to find spelling suggestion
    let didYouMean = null;
    if (!results || results.length === 0) {
      const { data: suggestion } = await supabase.rpc(
        'find_spelling_suggestion',
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
      results: results || [],
      didYouMean,
      count: results?.length || 0,
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
