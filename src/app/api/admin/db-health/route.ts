import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Provides database health metrics and index recommendations for authenticated users.
 *
 * @returns JSON NextResponse with:
 * - `health`: health check data or an empty array
 * - `indexRecommendations`: up to 10 index recommendations or an empty array
 * - `missingIndexes`: missing index suggestions or an empty array
 * - `checkedAt`: ISO timestamp when the check was performed
 *
 * On failure returns a JSON error object with status `401` (unauthorized) or `500` (internal server error).
 */
export async function GET() {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get health check summary
        const { data: healthCheck, error: healthError } = await supabase
            .rpc('check_database_health');

        if (healthError) {
            console.error('Health check error:', healthError);
        }

        // Get index recommendations
        const { data: recommendations, error: recError } = await supabase
            .from('index_recommendations')
            .select('*')
            .limit(10);

        if (recError) {
            console.error('Recommendations error:', recError);
        }

        // Get missing index suggestions
        const { data: missingSuggestions, error: missingError } = await supabase
            .rpc('get_missing_index_suggestions');

        if (missingError) {
            console.error('Missing suggestions error:', missingError);
        }

        return NextResponse.json({
            health: healthCheck || [],
            indexRecommendations: recommendations || [],
            missingIndexes: missingSuggestions || [],
            checkedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('DB health check error:', error);
        return NextResponse.json(
            { error: 'Failed to check database health' },
            { status: 500 }
        );
    }
}