import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createAdminClient } from '@/lib/supabase/admin';
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

    // Step 2: Resolve merchant (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Admin routes require being the merchant owner, not staff
    if (merchantContext.staffAccess.isStaff) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Step 3: Admin role check
    const { data: adminCheck } = await supabase
      .from('merchants')
      .select('is_platform_admin')
      .eq('id', merchantId)
      .maybeSingle();

    if (!adminCheck?.is_platform_admin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // `check_database_health` is locked to the service_role per the
    // 20260428071421 advisor cleanup (no internal authz inside the
    // function). Call it through the admin client; route-level admin
    // gating above (is_platform_admin check) is the trust boundary.
    const adminSupabase = createAdminClient();
    const { data: healthCheck, error: healthError } = await adminSupabase.rpc(
      'check_database_health'
    );

    if (healthError) {
      console.error('Health check error:', healthError);
    }

    // Get index recommendations
    const { data: recommendations, error: recError } = await supabase
      .from('index_recommendations')
      .select(
        'id, table_name, column_name, index_type, reason, priority, created_at'
      )
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
