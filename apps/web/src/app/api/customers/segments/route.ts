import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

/**
 * Customer Segments API
 *
 * GET - Get customer segment summary and list of customers by segment
 * POST - Refresh customer segments (triggers RFM recalculation)
 *
 * Query params (GET):
 * - segment: string (filter by specific segment)
 * - page: number
 * - limit: number
 */

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant context (supports both owners and staff members)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'customers', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    const { searchParams } = new URL(request.url);
    const segment = searchParams.get('segment');
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(
      Number.parseInt(searchParams.get('limit') || '20', 10),
      100
    );
    const offset = (page - 1) * limit;

    // Get segment summary
    const { data: summary } = await supabase
      .from('customer_segment_summary')
      .select('*')
      .eq('merchant_id', merchantId);

    // Get customers with RFM scores
    let query = supabase
      .from('customer_rfm_scores')
      .select(
        `
        *,
        customers (
          id,
          name,
          email,
          phone,
          store_credit,
          created_at
        )
      `,
        { count: 'exact' }
      )
      .eq('merchant_id', merchantId)
      .order('predicted_clv', { ascending: false })
      .range(offset, offset + limit - 1);

    if (segment) {
      query = query.eq('rfm_segment', segment);
    }

    const { data: customers, error, count } = await query;

    if (error) {
      console.error('Error fetching customer segments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch segments' },
        { status: 500 }
      );
    }

    // Get segment definitions
    const { data: definitions } = await supabase
      .from('segment_definitions')
      .select('*')
      .or(`merchant_id.is.null,merchant_id.eq.${merchantId}`)
      .order('priority', { ascending: false });

    return NextResponse.json({
      customers: customers?.map((c) => ({
        customerId: c.customer_id,
        customer: c.customers,
        rfmSegment: c.rfm_segment,
        lifecycleSegment: c.lifecycle_segment,
        recencyScore: c.recency_score,
        frequencyScore: c.frequency_score,
        monetaryScore: c.monetary_score,
        rfmScore: `${c.recency_score}${c.frequency_score}${c.monetary_score}`,
        totalOrders: c.total_orders,
        totalSpent: c.total_spent,
        averageOrderValue: c.average_order_value,
        daysSinceLastOrder: c.days_since_last_order,
        firstOrderDate: c.first_order_date,
        lastOrderDate: c.last_order_date,
        predictedClv: c.predicted_clv,
        churnRisk: c.churn_risk,
        updatedAt: c.updated_at,
      })),
      summary: summary || [],
      definitions: definitions || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Customer segments GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(_request: NextRequest) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(_request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant context (supports both owners and staff members)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'customers', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    // Trigger segment refresh
    const { data: result, error } = await supabase.rpc(
      'refresh_customer_segments',
      {
        p_merchant_id: merchantId,
      }
    );

    if (error) {
      console.error('Error refreshing segments:', error);
      return NextResponse.json(
        { error: 'Failed to refresh segments' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      customersProcessed: result,
      message: `Successfully refreshed segments for ${result} customers`,
    });
  } catch (error) {
    console.error('Customer segments POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
