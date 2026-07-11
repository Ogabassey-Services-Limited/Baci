import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import type { PetrockEligibilityCheckKind } from './petrock-remediation-eligibility';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface PetrockEligibilityAssessment {
  eligibilityChecksCompleted: string[];
  eligibilityEvidence: Record<string, string | undefined>;
  id: string;
  status: string;
}

const ASSESSMENT_COLUMNS =
  'id, status, eligibility_evidence, eligibility_checks_completed';

function mapAssessment(
  row: Record<string, unknown>
): PetrockEligibilityAssessment {
  return {
    eligibilityChecksCompleted: Array.isArray(row.eligibility_checks_completed)
      ? (row.eligibility_checks_completed as string[])
      : [],
    eligibilityEvidence:
      typeof row.eligibility_evidence === 'object' &&
      row.eligibility_evidence !== null
        ? (row.eligibility_evidence as Record<string, string | undefined>)
        : {},
    id: String(row.id),
    status: String(row.status),
  };
}

async function readAssessment(
  supabaseAdmin: AdminClient,
  sourceLookupId: string,
  customerId: string
) {
  const { data, error } = await supabaseAdmin
    .from('petrock_orders')
    .select(ASSESSMENT_COLUMNS)
    .match({ customer_id: customerId, source_lookup_id: sourceLookupId })
    .maybeSingle();
  if (error) throw error;
  return data ? mapAssessment(data as Record<string, unknown>) : null;
}

export async function createPetrockEligibilityAssessment({
  customerId,
  evidence,
  identifierCiphertext,
  identifierHash,
  merchantId,
  sourceLookupId,
  supabaseAdmin,
}: {
  customerId: string;
  evidence: Record<string, string | undefined>;
  identifierCiphertext: string;
  identifierHash: string;
  merchantId: string;
  sourceLookupId: string;
  supabaseAdmin: AdminClient;
}) {
  const { data, error } = await supabaseAdmin
    .from('petrock_orders')
    .insert({
      customer_id: customerId,
      eligibility_evidence: evidence,
      identifier_ciphertext: identifierCiphertext,
      identifier_hash: identifierHash,
      merchant_id: merchantId,
      source_lookup_id: sourceLookupId,
      status: 'eligibility_pending',
    })
    .select(ASSESSMENT_COLUMNS)
    .maybeSingle();
  if (!error) {
    if (data) return mapAssessment(data as Record<string, unknown>);
    throw new Error('Eligibility assessment insert returned no row');
  }
  if ((error as { code?: string }).code !== '23505') throw error;

  const existing = await readAssessment(
    supabaseAdmin,
    sourceLookupId,
    customerId
  );
  if (!existing) throw new Error('Eligibility assessment conflict');
  return existing;
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

export function createPetrockEligibilityState(supabaseAdmin: AdminClient) {
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
    markSubmissionUnknown({
      orderId,
      reason,
    }: {
      orderId: string;
      reason: string;
    }) {
      return booleanRpc(
        supabaseAdmin,
        'mark_petrock_remediation_submission_unknown',
        { p_order_id: orderId, p_reason: reason }
      );
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
    resolveEligibility({
      carrier,
      customerMessage,
      deviceModel,
      orderId,
      statusSegment,
    }: {
      carrier: string;
      customerMessage: string;
      deviceModel?: string;
      orderId: string;
      statusSegment: string;
    }) {
      return booleanRpc(supabaseAdmin, 'set_petrock_eligibility_outcome', {
        p_carrier: carrier,
        p_customer_message: customerMessage,
        p_device_model: deviceModel ?? null,
        p_failure_reason: null,
        p_order_id: orderId,
        p_status: 'eligible',
        p_status_segment: statusSegment,
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

export async function readPetrockHouseCheckProduct(
  supabaseAdmin: AdminClient,
  productId: string
) {
  const { data, error } = await supabaseAdmin
    .from('imei_provider_products')
    .select(
      'product_id, price_usd, currency, order_field_name, active, synced_at'
    )
    .match({ product_id: productId, provider: 'petrock', type: 'imei' })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    active: data.active === true,
    currency: String(data.currency),
    orderFieldName:
      typeof data.order_field_name === 'string' ? data.order_field_name : null,
    priceUsd: data.price_usd === null ? null : Number(data.price_usd),
    productId: String(data.product_id),
    syncedAt: String(data.synced_at),
  };
}
