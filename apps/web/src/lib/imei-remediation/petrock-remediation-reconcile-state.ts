import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import type { PetrockEligibilityCheckKind } from './petrock-remediation-eligibility';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface ClaimedPetrockRemediationOrder {
  carrier: string | null;
  customer_id: string;
  device_model: string | null;
  eligibility_checks_completed: string[];
  eligibility_evidence: Record<string, string | undefined>;
  eligibility_next_check: PetrockEligibilityCheckKind | null;
  id: string;
  identifier_ciphertext: string | null;
  merchant_id: string;
  payment_currency: 'NGN' | 'USDT' | null;
  provider_attempt_started_at: string | null;
  provider_order_id: string | null;
  reconcile_attempts: number;
  reconcile_lease_token: string;
  remediation_product_id: string | null;
  refund_policy: 'no_refund_denial' | 'refundable' | null;
  status: string;
}

async function booleanRpc(
  supabaseAdmin: AdminClient,
  name: string,
  args: Record<string, unknown>
) {
  const { data, error } = await supabaseAdmin.rpc(name, args);
  if (error) throw error;
  return data === true;
}

export async function claimPetrockRemediationOrders({
  leaseToken,
  limit = 25,
  supabaseAdmin,
}: {
  leaseToken: string;
  limit?: number;
  supabaseAdmin: AdminClient;
}) {
  const { data, error } = await supabaseAdmin.rpc(
    'claim_petrock_remediation_orders',
    { p_lease_seconds: 90, p_lease_token: leaseToken, p_limit: limit }
  );
  if (error) throw error;
  return (data ?? []) as ClaimedPetrockRemediationOrder[];
}

export function createPetrockRemediationReconcileState(
  supabaseAdmin: AdminClient
) {
  return {
    begin({
      check,
      feedbackTokenHash,
      orderId,
      referenceId,
    }: {
      check: PetrockEligibilityCheckKind;
      feedbackTokenHash: string;
      orderId: string;
      referenceId: string;
    }) {
      return booleanRpc(supabaseAdmin, 'begin_petrock_eligibility_check', {
        p_check_kind: check,
        p_feedback_token_hash: feedbackTokenHash,
        p_order_id: orderId,
        p_reference_id: referenceId,
      });
    },
    advanceEvidence({
      check,
      evidence,
      orderId,
      providerStatus,
    }: {
      check: PetrockEligibilityCheckKind;
      evidence: Record<string, unknown>;
      orderId: string;
      providerStatus: string;
    }) {
      return booleanRpc(supabaseAdmin, 'advance_petrock_eligibility_evidence', {
        p_check_kind: check,
        p_evidence: evidence,
        p_order_id: orderId,
        p_provider_status: providerStatus,
      });
    },
    finalize({
      customerMessage,
      failureReason,
      orderId,
      providerStatus,
      success,
    }: {
      customerMessage: string;
      failureReason?: string;
      orderId: string;
      providerStatus: string;
      success: boolean;
    }) {
      return booleanRpc(supabaseAdmin, 'finalize_petrock_remediation_order', {
        p_customer_message: customerMessage,
        p_failure_reason: failureReason ?? null,
        p_order_id: orderId,
        p_provider_status: providerStatus,
        p_success: success,
      });
    },
    failBeforeAcceptance({
      customerMessage,
      orderId,
      reason,
    }: {
      customerMessage: string;
      orderId: string;
      reason: string;
    }) {
      return booleanRpc(
        supabaseAdmin,
        'fail_petrock_remediation_before_acceptance',
        {
          p_customer_message: customerMessage,
          p_order_id: orderId,
          p_reason: reason,
        }
      );
    },
    markSubmissionUnknown({
      orderId,
      providerOrderId,
      reason,
    }: {
      orderId: string;
      providerOrderId?: string;
      reason: string;
    }) {
      return booleanRpc(
        supabaseAdmin,
        'mark_petrock_remediation_submission_unknown',
        {
          p_order_id: orderId,
          p_provider_order_id: providerOrderId ?? null,
          p_reason: reason,
        }
      );
    },
    resolveEligibility({
      carrier,
      customerMessage,
      deviceModel,
      failureReason,
      orderId,
      status,
      statusSegment,
    }: {
      carrier?: string;
      customerMessage: string;
      deviceModel?: string;
      failureReason?: string;
      orderId: string;
      status: 'eligible' | 'suppressed';
      statusSegment?: string;
    }) {
      return booleanRpc(supabaseAdmin, 'set_petrock_eligibility_outcome', {
        p_carrier: carrier ?? null,
        p_customer_message: customerMessage,
        p_device_model: deviceModel ?? null,
        p_failure_reason: failureReason ?? null,
        p_order_id: orderId,
        p_status: status,
        p_status_segment: statusSegment ?? null,
      });
    },
    recordSubmission({
      nextPollAt,
      orderId,
      providerOrderId,
      providerStatus,
    }: {
      nextPollAt: string;
      orderId: string;
      providerOrderId: string;
      providerStatus: string;
    }) {
      return booleanRpc(
        supabaseAdmin,
        'record_petrock_remediation_submission',
        {
          p_next_poll_at: nextPollAt,
          p_order_id: orderId,
          p_provider_order_id: providerOrderId,
          p_provider_status: providerStatus,
        }
      );
    },
    reschedule({
      leaseToken,
      nextPollAt,
      orderId,
      providerStatus,
    }: {
      leaseToken: string;
      nextPollAt: string;
      orderId: string;
      providerStatus: string;
    }) {
      return booleanRpc(supabaseAdmin, 'reschedule_petrock_remediation_order', {
        p_lease_token: leaseToken,
        p_next_poll_at: nextPollAt,
        p_order_id: orderId,
        p_provider_status: providerStatus,
      });
    },
    suppress({
      message,
      orderId,
      reason,
    }: {
      message: string;
      orderId: string;
      reason: string;
    }) {
      return booleanRpc(supabaseAdmin, 'set_petrock_eligibility_outcome', {
        p_carrier: null,
        p_customer_message: message,
        p_device_model: null,
        p_failure_reason: reason,
        p_order_id: orderId,
        p_status: 'suppressed',
        p_status_segment: null,
      });
    },
  };
}

export async function readApprovedPetrockRemediationProducts(
  supabaseAdmin: AdminClient
) {
  const { data, error } = await supabaseAdmin
    .from('petrock_remediation_products')
    .select('id, carrier, model_scope, status_segment, manual_disabled')
    .match({
      fixture_verified: true,
      is_active: true,
      manual_disabled: false,
      review_status: 'approved',
    });
  if (error) throw error;
  return data ?? [];
}
