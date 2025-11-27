import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Provide database health metrics, index recommendations, and missing index suggestions for authenticated users.
 *
 * Calls database RPCs and a recommendations table and returns their results along with a timestamp.
 *
 * @returns A NextResponse whose JSON body contains:
 * - `health`: an array of health metrics (or an empty array if unavailable)
 * - `indexRecommendations`: an array of index recommendation rows (or an empty array if unavailable)
 * - `missingIndexes`: an array of missing index suggestions (or an empty array if unavailable)
 * - `checkedAt`: the current ISO timestamp string
 *
 * Responds with status 401 and `{ error: 'Unauthorized' }` when there is no authenticated user, or with status 500 and `{ error: 'Failed to check database health' }` on unexpected failures.
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