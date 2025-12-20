import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/db-health
 * Returns database health metrics and index recommendations
 * Only accessible to platform administrators
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Step 1: Authentication check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Admin role check
    const { data: merchant } = await supabase
      .from('merchants')
      .select('is_platform_admin')
      .eq('user_id', user.id)
      .single();

    if (!merchant?.is_platform_admin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get health check summary
    const { data: healthCheck, error: healthError } = await supabase.rpc(
      'check_database_health'
    );

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
    const { data: missingSuggestions, error: missingError } =
      await supabase.rpc('get_missing_index_suggestions');

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
