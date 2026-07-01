import {
  claimStatusLabel,
  normalizeClaimStatus,
} from '@/lib/insurance/claim-status';
import { logger } from '@/lib/logger';
import { createMyCoverClient } from '@/lib/mycover';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Sync status of pending claims from the MyCover v2 API into
 * `order_insurance_policies` (used by the reconciliation cron).
 */
export async function syncClaimsStatus() {
  const supabase = createAdminClient();
  const myCover = createMyCoverClient();

  if (!myCover)
    return { success: false, message: 'MyCover client config missing' };

  try {
    // Fetch claims from v2 API (no type filter — match all by mycover_policy_id)
    const { claims } = await myCover.getClaims();

    let updateCount = 0;

    for (const claim of claims) {
      const policyId =
        (claim.policy as { id: string } | undefined)?.id ||
        (claim.policy_id as string | undefined);

      if (!policyId) continue;

      const { data: localPolicy } = await supabase
        .from('order_insurance_policies')
        .select(
          'id, status, claim_status, claim_stage, claim_progress, claim_comment, claim_id'
        )
        .eq('mycover_policy_id', policyId)
        .single();

      if (!localPolicy) continue;

      // Map v2 claim status to our shared normalized vocabulary.
      const rawStatus = String(claim.claim_status || claim.status || '');
      const paymentStatus = String(claim.payment_status || '').toLowerCase();
      const paymentStatusIndicatesPaid =
        paymentStatus === 'paid' ||
        paymentStatus === 'settled' ||
        paymentStatus === 'payment settled';
      const newClaimStatus = paymentStatusIndicatesPaid
        ? 'paid'
        : normalizeClaimStatus(rawStatus);
      const claimStage = paymentStatusIndicatesPaid
        ? claimStatusLabel(newClaimStatus)
        : rawStatus.trim() || claimStatusLabel(newClaimStatus);
      const incomingClaimProgress =
        (claim.progress as string | undefined) ??
        (claim.meta as { progress?: string } | undefined)?.progress;
      const claimProgress =
        incomingClaimProgress ?? localPolicy.claim_progress ?? null;
      const claimComment =
        (claim.comment as string | undefined) ??
        localPolicy.claim_comment ??
        null;

      // Update when ANY of the tracked claim fields changed, not just the
      // coarse status token (offer/progress/comment can move while status holds).
      const changed =
        localPolicy.claim_status !== newClaimStatus ||
        localPolicy.claim_stage !== claimStage ||
        localPolicy.claim_progress !== claimProgress ||
        localPolicy.claim_comment !== claimComment ||
        localPolicy.claim_id !== claim.id;

      if (changed) {
        const { error: updateError } = await supabase
          .from('order_insurance_policies')
          .update({
            claim_status: newClaimStatus,
            claim_stage: claimStage,
            claim_progress: claimProgress,
            claim_comment: claimComment,
            claim_id: claim.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', localPolicy.id);

        if (updateError) {
          logger.error({
            message: '[Insurance] Failed to update claim status',
            error: updateError,
            policyId: localPolicy.id,
          });
          continue;
        }
        updateCount++;
      }
    }

    return { success: true, updated: updateCount };
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error');
    logger.error({ message: 'Claims sync failed', error });
    return { success: false, error: error.message };
  }
}
