import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const merchantId = searchParams.get('merchant_id');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || !merchantId) {
        return NextResponse.json(
            { error: 'Missing query or merchant_id parameter' },
            { status: 400 }
        );
    }

    // Don't autocomplete very short queries
    if (query.length < 2) {
        return NextResponse.json({ suggestions: [] });
    }

    try {
        const supabase = await createClient();

        // Use autocomplete function for fast prefix matching
        const { data: productSuggestions, error } = await supabase
            .rpc('product_autocomplete', {
                search_prefix: query,
                merchant_id_param: merchantId,
                result_limit: limit - 3  // Leave room for popular searches
            });

        if (error) throw error;

        // Get popular searches that match
        const { data: popularSearches } = await supabase
            .from('popular_searches')
            .select('search_query, search_count')
            .eq('merchant_id', merchantId)
            .ilike('search_query', `%${query}%`)
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
