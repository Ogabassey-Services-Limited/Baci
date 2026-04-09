import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Fetch all policies for this order (supports gadget + future shipping)
    const { data: policies, error } = await supabase
      .from('order_insurance_policies')
      .select(
        'id, order_id, mycover_policy_number, status, policy_start_date, policy_expiry_date, premium_amount, coverage_amount, items_insured, claim_status, certificate_url, provider_name, policy_type'
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
        certificateUrl: policy.certificate_url,
      })),
    });
  } catch (_error: unknown) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
