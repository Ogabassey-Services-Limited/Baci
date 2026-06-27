import type { SupabaseClient } from '@supabase/supabase-js';
import { maybeNotifyActivateProtection } from '@/lib/insurance/notify-activate-protection';
import type { MyCoverWebhookPayload } from '@/schemas/mycover-webhook';
import {
  getCurrentPolicyInspectionState,
  getHostedFlowLinks,
  hostedFlowUpdateColumns,
} from './webhook-hosted-flows';
import {
  getCertificateUrl,
  getPolicyExpiryDate,
  getPolicyId,
  getPolicyLookup,
  getPolicyNumber,
  getPolicyStartDate,
  resolveRenewalPolicyLookup,
} from './webhook-policy-lookups';
import type { MyCoverUpdatedPolicy } from './webhook-types';

async function notifyActivateProtectionIfDelivered(orderId: string) {
  try {
    await maybeNotifyActivateProtection(orderId);
  } catch (error) {
    console.error(
      '[MyCover Webhook] Failed to check activation reminder after hosted link update:',
      error
    );
  }
}

export async function handlePolicyPurchased(
  supabase: SupabaseClient,
  data: MyCoverWebhookPayload['data'],
  event: MyCoverWebhookPayload['event']
) {
  const lookup = getPolicyLookup(data, {
    dataIdColumn:
      event === 'purchase.successful'
        ? 'mycover_purchase_id'
        : 'mycover_policy_id',
  });
  if (!lookup) {
    console.warn('[MyCover Webhook] Policy purchased without policy_id');
    return;
  }

  const hostedFlowLinks = getHostedFlowLinks(data);
  const currentInspectionState = hostedFlowLinks.inspection_link
    ? await getCurrentPolicyInspectionState(supabase, lookup)
    : null;
  const { data: updatedPolicy, error } = await supabase
    .from('order_insurance_policies')
    .update({
      mycover_policy_number: getPolicyNumber(data),
      policy_start_date: getPolicyStartDate(data),
      policy_expiry_date: getPolicyExpiryDate(data),
      certificate_url: getCertificateUrl(data),
      status: 'active',
      updated_at: new Date().toISOString(),
      // Hosted flows for filing a claim / completing a device inspection.
      ...hostedFlowUpdateColumns(hostedFlowLinks, currentInspectionState),
    })
    .eq(lookup.column, lookup.value)
    .select('id, order_id')
    .maybeSingle<MyCoverUpdatedPolicy>();

  if (error) {
    console.error('[MyCover Webhook] Failed to update policy:', error);
    throw error;
  }

  if (!updatedPolicy) {
    throw new Error('MyCover purchase webhook did not match a stored policy');
  }

  const safeIdentifier = lookup.value.replace(/[\r\n]/g, '');
  console.log('[MyCover Webhook] Policy confirmed:', safeIdentifier);

  if (hostedFlowLinks.inspection_link && updatedPolicy.order_id) {
    await notifyActivateProtectionIfDelivered(updatedPolicy.order_id);
  }
}

export async function handlePolicyRenewed(
  supabase: SupabaseClient,
  data: MyCoverWebhookPayload['data'],
  event: MyCoverWebhookPayload['event'],
  configuredSecret: string
) {
  const resolvesDataIdAsPurchase =
    event === 'purchase.renewed' || event === 'renewal.successful';
  let lookup = getPolicyLookup(data, {
    dataIdColumn: resolvesDataIdAsPurchase ? null : 'mycover_policy_id',
  });
  if (!lookup && resolvesDataIdAsPurchase && data.id) {
    lookup = await resolveRenewalPolicyLookup(data.id, configuredSecret);
  }

  if (!lookup) {
    throw new Error(
      'MyCover renewal webhook missing stored policy or purchase identifier'
    );
  }

  const hostedFlowLinks = getHostedFlowLinks(data);
  const currentInspectionState = hostedFlowLinks.inspection_link
    ? await getCurrentPolicyInspectionState(supabase, lookup)
    : null;
  const { data: updatedPolicy, error } = await supabase
    .from('order_insurance_policies')
    .update({
      policy_expiry_date: getPolicyExpiryDate(data),
      status: 'active',
      updated_at: new Date().toISOString(),
      ...hostedFlowUpdateColumns(hostedFlowLinks, currentInspectionState),
    })
    .eq(lookup.column, lookup.value)
    .select('id, order_id')
    .maybeSingle<MyCoverUpdatedPolicy>();

  if (error) {
    console.error('[MyCover Webhook] Failed to renew policy:', error);
    throw error;
  }

  if (!updatedPolicy) {
    throw new Error('MyCover renewal webhook did not match a stored policy');
  }

  if (hostedFlowLinks.inspection_link && updatedPolicy.order_id) {
    await notifyActivateProtectionIfDelivered(updatedPolicy.order_id);
  }
}

/**
 * Handle `policy.updated` — chiefly certificate (re)generation, but also policy
 * detail edits. Best-effort: a policy we don't track simply matches no row.
 */
export async function handlePolicyUpdated(
  supabase: SupabaseClient,
  data: MyCoverWebhookPayload['data']
) {
  const lookup = getPolicyLookup(data, { dataIdColumn: 'mycover_policy_id' });
  if (!lookup) return;

  const hostedFlowLinks = getHostedFlowLinks(data);
  const currentInspectionState = hostedFlowLinks.inspection_link
    ? await getCurrentPolicyInspectionState(supabase, lookup)
    : null;
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ...hostedFlowUpdateColumns(hostedFlowLinks, currentInspectionState),
  };
  const certificateUrl = getCertificateUrl(data);
  const policyNumber = getPolicyNumber(data);
  const expiryDate = getPolicyExpiryDate(data);
  if (certificateUrl) update.certificate_url = certificateUrl;
  if (policyNumber) update.mycover_policy_number = policyNumber;
  if (expiryDate) update.policy_expiry_date = expiryDate;

  const { data: updatedPolicy, error } = await supabase
    .from('order_insurance_policies')
    .update(update)
    .eq(lookup.column, lookup.value)
    .select('id, order_id')
    .maybeSingle<MyCoverUpdatedPolicy>();

  if (error) {
    console.error('[MyCover Webhook] Failed to apply policy.updated:', error);
    throw error;
  }

  if (hostedFlowLinks.inspection_link && updatedPolicy?.order_id) {
    await notifyActivateProtectionIfDelivered(updatedPolicy.order_id);
  }
}

export async function handlePolicyExpired(
  supabase: SupabaseClient,
  data: MyCoverWebhookPayload['data']
) {
  const policyId = getPolicyId(data);
  if (!policyId) return;

  const { error } = await supabase
    .from('order_insurance_policies')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('mycover_policy_id', policyId);

  if (error) {
    console.error('[MyCover Webhook] Failed to expire policy:', {
      error,
      policyId,
    });
    throw error;
  }
}
