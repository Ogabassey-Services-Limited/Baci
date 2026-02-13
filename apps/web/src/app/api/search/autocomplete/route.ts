import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  isValidUuid,
  sanitizeLikePattern,
  sanitizeSearchQuery,
} from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawQuery = searchParams.get('q');
  const merchantId = searchParams.get('merchant_id');
  const limit = Number.parseInt(searchParams.get('limit') || '10', 10);

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

  // Sanitize search query
  const query = sanitizeSearchQuery(rawQuery);

  // Don't autocomplete very short queries
  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Use autocomplete function for fast prefix matching
    const { data: productSuggestions, error } = await supabase.rpc(
      'product_autocomplete',
      {
        search_prefix: query,
        merchant_id_param: merchantId,
        result_limit: limit - 3, // Leave room for popular searches
      }
    );

    if (error) throw error;

    // Get popular searches that match
    const { data: popularSearches } = await supabase
      .from('popular_searches')
      .select('search_query, search_count')
      .eq('merchant_id', merchantId)
      .ilike('search_query', `%${sanitizeLikePattern(query)}%`)
      .order('search_count', { ascending: false })
      .limit(3);

    return NextResponse.json({
      suggestions: productSuggestions || [],
      popularSearches: popularSearches || [],
    });
  } catch (error) {
    console.error('Autocomplete error:', error);
    return NextResponse.json(
      { error: 'Failed to get autocomplete suggestions' },
      { status: 500 }
    );
  }
}
