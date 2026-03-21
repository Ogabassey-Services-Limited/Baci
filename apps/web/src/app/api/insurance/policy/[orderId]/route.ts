import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    // Auth check - Optional but recommended for viewing policies
    // Or we rely on session checking if user owns the order
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Fetch policy linked to this order
    const { data: policy, error } = await supabase
      .from('order_insurance_policies')
      .select(
        'id, order_id, mycover_policy_number, status, policy_start_date, policy_expiry_date, premium_amount, coverage_amount, items_insured, claim_status, certificate_url'
      )
      .eq('order_id', orderId)
      .single();

    if (error || !policy) {
      return NextResponse.json({
        found: false,
        message: 'No insurance policy found for this order',
      });
    }

    // Return policy details
    // We could also do a live check vs MyCover API here if needed to sync status
    // For MVP, returning stored DB state is faster and sufficient provided webhooks work

    return NextResponse.json({
      found: true,
      policy: {
        id: policy.id,
        policyNumber: policy.mycover_policy_number,
        provider: 'Sovereign Trust Insurance', // Hardcoded as per Gadget product
        status: policy.status, // active, expired, pending
        startDate: policy.policy_start_date,
        expiryDate: policy.policy_expiry_date,
        premium: policy.premium_amount,
        coverage: policy.coverage_amount,
        itemsInsured: policy.items_insured,
        claimStatus: policy.claim_status || 'None', // e.g., 'Pending', 'Approved'
        // Add link to download certificate if available (PDF URL from MyCover?)
        certificateUrl: policy.certificate_url,
      },
    });
    // biome-ignore lint/suspicious/noExplicitAny: Error from catch block
  } catch (_error: any) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
