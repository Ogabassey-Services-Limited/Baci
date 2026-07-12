import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import {
  type PetrockModelScope,
  parsePetrockModelScope,
} from './petrock-device-model';
import { evaluatePetrockRemediationEligibility } from './petrock-remediation-eligibility';

type AdminClient = ReturnType<typeof createAdminClient>;

interface ProductRow {
  carrier: string;
  excluded_reason: string | null;
  id: string;
  launch_carrier: boolean;
  manual_disabled: boolean;
  model_scope: unknown;
  price_ngn: number | string;
  price_usdt: number | string;
  provider_product_id: string;
  raw_name: string;
  refund_policy: 'no_refund_denial' | 'refundable';
  status_segment: string;
  success_rate: number | string | null;
  turnaround: string | null;
}

interface SellableProduct extends Omit<ProductRow, 'model_scope'> {
  model_scope: PetrockModelScope;
  price_ngn: number;
  price_usdt: number;
}

function stringEvidence(value: unknown): Record<string, string> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );
}

function parseCuratedProduct(row: ProductRow): SellableProduct | null {
  const modelScope = parsePetrockModelScope(row.model_scope);
  const priceNgn = Number(row.price_ngn);
  const priceUsdt = Number(row.price_usdt);
  if (
    row.excluded_reason !== null ||
    row.launch_carrier !== true ||
    typeof row.provider_product_id !== 'string' ||
    !row.provider_product_id ||
    !modelScope ||
    !Number.isFinite(priceNgn) ||
    priceNgn <= 0 ||
    !Number.isFinite(priceUsdt) ||
    priceUsdt <= 0
  ) {
    return null;
  }
  return {
    ...row,
    model_scope: modelScope,
    price_ngn: priceNgn,
    price_usdt: priceUsdt,
  };
}

async function loadActiveCatalogProductIds(supabaseAdmin: AdminClient) {
  const { data, error } = await supabaseAdmin
    .from('imei_provider_products')
    .select('product_id')
    .match({
      active: true,
      currency: 'USD',
      provider: 'petrock',
      type: 'imei',
    });
  if (error) throw error;
  return new Set(
    (data ?? []).flatMap((row) =>
      typeof row.product_id === 'string' ? [row.product_id] : []
    )
  );
}

export async function loadPetrockRemediationEligibility({
  customerId,
  identifierHash,
  lookupId,
  merchantId,
  supabaseAdmin,
}: {
  customerId: string;
  identifierHash: string;
  lookupId: string;
  merchantId: string;
  supabaseAdmin: AdminClient;
}) {
  const { data: lookup, error: lookupError } = await supabaseAdmin
    .from('imei_lookups')
    .select('id, cached_response')
    .match({
      customer_id: customerId,
      id: lookupId,
      imei_hash: identifierHash,
      merchant_id: merchantId,
    })
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!lookup) return { kind: 'not_found' as const };

  const { data: assessment, error: assessmentError } = await supabaseAdmin
    .from('petrock_orders')
    .select(
      'id, status, eligibility_evidence, failure_reason, remediation_product_id'
    )
    .match({ customer_id: customerId, source_lookup_id: lookupId })
    .maybeSingle();
  if (assessmentError) throw assessmentError;
  if (
    assessment?.status === 'eligibility_pending' ||
    assessment?.status === 'submission_unknown'
  ) {
    return { assessmentId: String(assessment.id), kind: 'pending' as const };
  }
  if (assessment?.status === 'suppressed') {
    return {
      kind: 'suppressed' as const,
      reason:
        typeof assessment.failure_reason === 'string'
          ? assessment.failure_reason
          : 'not_eligible',
    };
  }
  const resumableAssessment =
    assessment?.status === 'eligible' ||
    assessment?.status === 'payment_pending';
  const cached = lookup.cached_response as Record<string, unknown> | null;
  const result =
    cached?.success === true &&
    typeof cached.data === 'object' &&
    cached.data !== null
      ? stringEvidence(cached.data)
      : null;
  if (!resumableAssessment && !result) {
    return { kind: 'not_found' as const };
  }
  const evidence = resumableAssessment
    ? (stringEvidence(assessment.eligibility_evidence) ?? {})
    : (result ?? {});

  const { data, error } = await supabaseAdmin
    .from('petrock_remediation_products')
    .select(
      'id, provider_product_id, raw_name, carrier, model_scope, status_segment, refund_policy, success_rate, turnaround, price_ngn, price_usdt, manual_disabled, excluded_reason, launch_carrier'
    )
    .match({
      excluded_reason: null,
      fixture_verified: true,
      is_active: true,
      launch_carrier: true,
      manual_disabled: false,
      review_status: 'approved',
    });
  if (error) throw error;
  const curatedProducts = ((data ?? []) as ProductRow[]).flatMap((product) => {
    const parsed = parseCuratedProduct(product);
    return parsed ? [parsed] : [];
  });
  const activeProductIds =
    curatedProducts.length > 0
      ? await loadActiveCatalogProductIds(supabaseAdmin)
      : new Set<string>();
  const products = curatedProducts.filter((product) =>
    activeProductIds.has(product.provider_product_id)
  );
  const evaluation = evaluatePetrockRemediationEligibility({
    products: products.map((product) => ({
      carrier: product.carrier,
      id: product.id,
      isActive: true,
      manualDisabled: product.manual_disabled,
      modelScope: product.model_scope,
      statusSegment: product.status_segment,
    })),
    result: evidence,
  });

  if (evaluation.kind !== 'eligible') {
    return evaluation.kind === 'checks_required'
      ? { ...evaluation, evidence }
      : evaluation;
  }
  const eligible = new Set(evaluation.productIds);
  const lockedProductId =
    assessment?.status === 'payment_pending' &&
    typeof assessment.remediation_product_id === 'string'
      ? assessment.remediation_product_id
      : null;
  return {
    assessmentId: resumableAssessment ? String(assessment.id) : undefined,
    evidence,
    kind: 'eligible' as const,
    needsAssessment: !resumableAssessment,
    offers: products
      .filter(
        (product) =>
          eligible.has(product.id) &&
          (!lockedProductId || product.id === lockedProductId)
      )
      .map((product) => ({
        carrier: product.carrier,
        id: product.id,
        name: product.raw_name,
        priceNgn: product.price_ngn,
        priceUsdt: product.price_usdt,
        refundPolicy: product.refund_policy,
        statusSegment: product.status_segment,
        successRate:
          product.success_rate === null ? null : Number(product.success_rate),
        turnaround: product.turnaround,
      })),
  };
}
