import { cookies } from 'next/headers';
import { getMerchantSafe } from '@/lib/cached-data';
import { createClient } from '@/lib/supabase/server';
import { InsurancePolicyClient } from './insurance-policy-client';
import type { Policy, PolicyFetchResult } from './insurance-policy-types';

interface InsurancePolicyPageProps {
  params: Promise<{ orderId: string; slug: string }>;
}

interface PolicyRow {
  id: string;
  mycover_policy_number: string | null;
  status: Policy['status'];
  policy_start_date: string;
  policy_expiry_date: string;
  premium_amount: number;
  coverage_amount: number;
  items_insured: Policy['itemsInsured'];
  claim_status: string | null;
  claim_stage: string | null;
  claim_progress: string | null;
  claim_comment: string | null;
  certificate_url: string | null;
  provider_name: string | null;
  claim_link: string | null;
  inspection_link: string | null;
  inspection_status: string | null;
}

function mapPolicy(row: PolicyRow, orderDelivered: boolean): Policy {
  return {
    certificateUrl: row.certificate_url ?? undefined,
    claimComment: row.claim_comment ?? null,
    claimLink: row.claim_link ?? null,
    claimProgress: row.claim_progress ?? null,
    claimStage: row.claim_stage ?? null,
    claimStatus: row.claim_status || 'None',
    coverage: row.coverage_amount,
    expiryDate: row.policy_expiry_date,
    id: row.id,
    inspectionLink: row.inspection_link ?? null,
    inspectionStatus: row.inspection_status ?? null,
    itemsInsured: row.items_insured ?? null,
    orderDelivered,
    policyNumber: row.mycover_policy_number ?? '',
    premium: row.premium_amount,
    provider: row.provider_name || 'Sovereign Trust Insurance Plc',
    startDate: row.policy_start_date,
    status: row.status,
  };
}

async function fetchPolicyForOrder(
  orderId: string,
  storefrontIdentifier: string
): Promise<PolicyFetchResult> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { policy: null, error: 'Unauthorized' };
    }

    const merchant = await getMerchantSafe(storefrontIdentifier);
    if (!merchant?.is_published) {
      return {
        policy: null,
        error: 'No active insurance policy found for this order.',
      };
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('merchant_id', merchant.id)
      .eq('user_id', user.id)
      .maybeSingle<{ id: string }>();

    if (customerError) {
      return { policy: null, error: 'Failed to fetch customer account' };
    }
    if (!customer) {
      return {
        policy: null,
        error: 'No active insurance policy found for this order.',
      };
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('shipping_status')
      .eq('id', orderId)
      .eq('merchant_id', merchant.id)
      .eq('customer_id', customer.id)
      .maybeSingle<{ shipping_status: string | null }>();

    if (orderError) {
      return { policy: null, error: 'Failed to fetch order delivery status' };
    }
    if (!order) {
      return {
        policy: null,
        error: 'No active insurance policy found for this order.',
      };
    }

    const { data: policies, error: policyError } = await supabase
      .from('order_insurance_policies')
      .select(
        'id, mycover_policy_number, status, policy_start_date, policy_expiry_date, premium_amount, coverage_amount, items_insured, claim_status, claim_stage, claim_progress, claim_comment, certificate_url, provider_name, claim_link, inspection_link, inspection_status'
      )
      .eq('order_id', orderId);

    if (policyError) {
      return { policy: null, error: 'Failed to fetch policies' };
    }
    if (!policies || policies.length === 0) {
      return {
        policy: null,
        error: 'No active insurance policy found for this order.',
      };
    }

    const orderDelivered =
      order.shipping_status === 'delivered' ||
      order.shipping_status === 'completed';

    return {
      policy: mapPolicy(policies[0] as PolicyRow, orderDelivered),
      error: '',
    };
  } catch (error) {
    console.error('Failed to fetch insurance policy', error);
    return {
      policy: null,
      error: 'Internal server error',
    };
  }
}

export default async function InsurancePolicyPage({
  params,
}: InsurancePolicyPageProps) {
  const { orderId, slug } = await params;
  const initialResult = await fetchPolicyForOrder(orderId, slug);

  return <InsurancePolicyClient initialResult={initialResult} />;
}
