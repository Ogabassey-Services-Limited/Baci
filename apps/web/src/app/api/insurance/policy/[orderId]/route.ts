import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { orderPolicyRouteParamsSchema } from '@/schemas/insurance-route-params';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const routeParams = orderPolicyRouteParamsSchema.safeParse(await params);
    if (!routeParams.success) {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
    }
    const { orderId } = routeParams.data;

    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id);

    if (customerError) {
      return NextResponse.json(
        { error: 'Failed to fetch customer context' },
        { status: 500 }
      );
    }

    const customerIds = (customers ?? [])
      .map((customer) => customer.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (customerIds.length === 0) {
      return NextResponse.json({
        found: false,
        policies: [],
      });
    }

    // Verify this session can read the order through RLS before returning any
    // policy metadata or hosted claim/inspection links. The explicit
    // customer_id filter is defense in depth on top of RLS.
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('shipping_status, customer_id')
      .eq('id', orderId)
      .in('customer_id', customerIds)
      .maybeSingle();

    if (orderError) {
      return NextResponse.json(
        { error: 'Failed to fetch order delivery status' },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json({
        found: false,
        policies: [],
      });
    }

    // Fetch all policies for this order (supports gadget + future shipping).
    const { data: policies, error } = await supabase
      .from('order_insurance_policies')
      .select(
        'id, order_id, mycover_policy_number, status, policy_start_date, policy_expiry_date, premium_amount, coverage_amount, items_insured, claim_status, claim_stage, claim_progress, claim_comment, certificate_url, provider_name, policy_type, claim_link, inspection_link, inspection_status'
      )
      .eq('order_id', orderId);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch policies' },
        { status: 500 }
      );
    }

    if (!policies || policies.length === 0) {
      return NextResponse.json({
        found: false,
        policies: [],
      });
    }

    // Pre-loss inspection (which activates protection) can only happen once the
    // device is in the customer's hands, so the activation CTA is gated on
    // delivery.
    const orderDelivered =
      order?.shipping_status === 'delivered' ||
      order?.shipping_status === 'completed';

    return NextResponse.json({
      found: true,
      policies: policies.map((policy) => ({
        id: policy.id,
        policyType: policy.policy_type || 'gadget',
        policyNumber: policy.mycover_policy_number,
        provider: policy.provider_name || 'Sovereign Trust Insurance Plc',
        status: policy.status,
        startDate: policy.policy_start_date,
        expiryDate: policy.policy_expiry_date,
        premium: policy.premium_amount,
        coverage: policy.coverage_amount,
        itemsInsured: policy.items_insured,
        claimStatus: policy.claim_status || 'None',
        claimStage: policy.claim_stage ?? null,
        claimProgress: policy.claim_progress ?? null,
        claimComment: policy.claim_comment ?? null,
        certificateUrl: policy.certificate_url,
        claimLink: policy.claim_link ?? null,
        inspectionLink: policy.inspection_link ?? null,
        inspectionStatus: policy.inspection_status ?? null,
        orderDelivered,
      })),
    });
  } catch (_error: unknown) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
