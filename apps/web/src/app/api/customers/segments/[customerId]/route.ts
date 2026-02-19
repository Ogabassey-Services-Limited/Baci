import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

/**
 * Single Customer Segment API
 *
 * GET - Get detailed RFM analysis for a specific customer
 * POST - Recalculate RFM for a specific customer
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
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

    // Get customer details
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get RFM scores
    const { data: rfm } = await supabase
      .from('customer_rfm_scores')
      .select('*')
      .eq('customer_id', customerId)
      .eq('merchant_id', merchantId)
      .single();

    // Get loyalty data if exists
    const { data: loyalty } = await supabase
      .from('customer_loyalty')
      .select('*')
      .eq('customer_id', customerId)
      .eq('merchant_id', merchantId)
      .single();

    // Get recent orders
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, total, status, payment_status, created_at')
      .eq('customer_id', customerId)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get segment definition
    let segmentInfo = null;
    if (rfm?.rfm_segment) {
      const { data: definition } = await supabase
        .from('segment_definitions')
        .select('*')
        .eq('segment_name', rfm.rfm_segment)
        .or(`merchant_id.is.null,merchant_id.eq.${merchantId}`)
        .single();
      segmentInfo = definition;
    }

    return NextResponse.json({
      customer,
      rfm: rfm
        ? {
            segment: rfm.rfm_segment,
            lifecycleSegment: rfm.lifecycle_segment,
            recencyScore: rfm.recency_score,
            frequencyScore: rfm.frequency_score,
            monetaryScore: rfm.monetary_score,
            rfmScore: `${rfm.recency_score}${rfm.frequency_score}${rfm.monetary_score}`,
            totalOrders: rfm.total_orders,
            totalSpent: rfm.total_spent,
            averageOrderValue: rfm.average_order_value,
            daysSinceLastOrder: rfm.days_since_last_order,
            predictedClv: rfm.predicted_clv,
            churnRisk: rfm.churn_risk,
            firstOrderDate: rfm.first_order_date,
            lastOrderDate: rfm.last_order_date,
          }
        : null,
      loyalty: loyalty
        ? {
            pointsBalance: loyalty.points_balance,
            lifetimePoints: loyalty.lifetime_points,
            currentTier: loyalty.current_tier,
            referralCode: loyalty.referral_code,
            referralCount: loyalty.referral_count,
          }
        : null,
      segmentInfo,
      recentOrders,
    });
  } catch (error) {
    console.error('Customer segment GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
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
    if (!hasPermission(access, 'customers', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    // Recalculate RFM for this customer
    const { data: result, error } = await supabase.rpc(
      'calculate_customer_rfm',
      {
        p_customer_id: customerId,
        p_merchant_id: merchantId,
      }
    );

    if (error) {
      console.error('Error calculating RFM:', error);
      return NextResponse.json(
        { error: 'Failed to calculate RFM' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      rfm: result?.[0] || null,
    });
  } catch (error) {
    console.error('Customer segment POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
