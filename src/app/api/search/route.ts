import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const merchantId = searchParams.get('merchant_id');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query || !merchantId) {
        return NextResponse.json(
            { error: 'Missing query or merchant_id parameter' },
            { status: 400 }
        );
    }

    try {
        const supabase = await createClient();

        // Use smart search function
        const { data: results, error } = await supabase
            .rpc('smart_product_search', {
                search_query: query,
                merchant_id_param: merchantId,
                result_limit: limit
            });

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
            .then(() => {});  // Don't wait for response

        // If no results, try to find spelling suggestion
        let didYouMean = null;
        if (!results || results.length === 0) {
            const { data: suggestion } = await supabase
                .rpc('find_spelling_suggestion', {
                    search_term: query,
                    merchant_id_param: merchantId,
                });

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
