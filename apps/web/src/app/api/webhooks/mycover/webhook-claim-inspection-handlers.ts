import type { SupabaseClient } from '@supabase/supabase-js';
import {
  claimStatusLabel,
  normalizeClaimStatus,
} from '@/lib/insurance/claim-status';
import type { MyCoverWebhookPayload } from '@/schemas/mycover-webhook';
import { getHostedFlowLinks } from './webhook-hosted-flows';
import {
  getExplicitPolicyId,
  isPreLossInspectionApproved,
} from './webhook-policy-lookups';
import type { MyCoverUpdatedPolicy } from './webhook-types';

export async function handleInspectionCompleted(
  supabase: SupabaseClient,
  data: MyCoverWebhookPayload['data']
) {
  const inspectionCategory = data.meta?.category ?? data.essential?.category;
  if (inspectionCategory !== 'preloss') {
    return;
  }

  const policyId =
    data.meta?.policy_id || data.essential?.policy_id || data.policy_id;
  if (!policyId) {
    console.warn('[MyCover Webhook] inspection.completed without policy_id');
    return;
  }

  // MyCover's documented `inspection.completed` payload reports
  // `essential.status: 'completed'`; the `is_approved` flag is a separate
  // outcome signal. Treat either as a genuine completion so a delivered customer
  // isn't left stuck behind the activation gate when an event lands unapproved.
  const isDocumentedCompletion =
    data.essential?.status?.trim().toLowerCase() === 'completed';
  if (!(isPreLossInspectionApproved(data) || isDocumentedCompletion)) {
    console.warn(
      '[MyCover Webhook] Ignored incomplete pre-loss inspection:',
      policyId.replace(/[\r\n]/g, '')
    );
    return;
  }

  const { claim_link: claimLink } = getHostedFlowLinks(data);

  const { data: updatedPolicy, error } = await supabase
    .from('order_insurance_policies')
    .update({
      ...(claimLink ? { claim_link: claimLink } : {}),
      inspection_status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('mycover_policy_id', policyId)
    .select('id')
    .maybeSingle<MyCoverUpdatedPolicy>();

  if (error) {
    console.error(
      '[MyCover Webhook] Failed to mark inspection complete:',
      error
    );
    throw error;
  }

  const safeIdentifier = policyId.replace(/[\r\n]/g, '');

  // No-op (not an error): the same MyCover account also emits inspection
  // webhooks for policies we don't store (test account, other channels).
  if (!updatedPolicy) {
    console.warn(
      '[MyCover Webhook] inspection.completed matched no stored policy:',
      safeIdentifier
    );
    return;
  }

  console.log(
    '[MyCover Webhook] Pre-loss inspection completed:',
    safeIdentifier
  );
}

export async function handleClaimUpdate(
  supabase: SupabaseClient,
  payload: MyCoverWebhookPayload
) {
  const { event, data } = payload;
  const policyId = getExplicitPolicyId(data);
  if (!policyId) return;

  // The authoritative claim state is `data.essential.status`; legacy claim
  // webhooks can also place it on `data.status` or `data.claim_status`. Fall
  // back to the event name only when the payload has no explicit claim state.
  const rawStatus = data.essential?.status ?? data.claim_status ?? data.status;
  const token = normalizeClaimStatus(rawStatus, event);
  const stage = rawStatus?.trim() || claimStatusLabel(token);
  const claimProgress = data.meta?.progress;
  const claimComment = data.essential?.comment ?? data.meta?.comment;

  const updateData: Record<string, unknown> = {
    claim_status: token,
    claim_stage: stage,
    updated_at: new Date().toISOString(),
  };
  if (claimProgress !== undefined) updateData.claim_progress = claimProgress;
  if (claimComment !== undefined) updateData.claim_comment = claimComment;
  const { claim_link: claimLink } = getHostedFlowLinks(data);
  if (claimLink) updateData.claim_link = claimLink;
  // Claim webhooks may carry the claim's primary id as `data.id` when
  // `data.claim_id` is absent — persist either so claim_id isn't left null.
  const claimId = data.claim_id ?? data.id;
  if (claimId) updateData.claim_id = claimId;
  if (token === 'approved' || token === 'paid') {
    updateData.status = 'claimed';
  }

  const { data: updatedPolicy, error } = await supabase
    .from('order_insurance_policies')
    .update(updateData)
    .eq('mycover_policy_id', policyId)
    .select('id')
    .maybeSingle<MyCoverUpdatedPolicy>();

  if (error) {
    console.error('[MyCover Webhook] Failed to update claim:', {
      error,
      policyId,
    });
    throw error;
  }

  if (!updatedPolicy) {
    const safePolicyId = policyId.replace(/[\r\n]/g, '');
    console.warn('[MyCover Webhook] claim update matched no stored policy:', {
      policyId: safePolicyId,
    });
  }
}
