// Δ-0a / Δ-27: `transactions` has no `gateway_fee` column. The verified
// Paystack response is the source of truth for fees (see webhook/route.ts
// line 1698). `gateway_reference` is included so settlement can pass the
// canonical BAC-* key per the Δ-22 invariant — Paystack's numeric ref
// goes into `merchant_settlements.metadata.paystack_reference` only.
export const AGENTIC_PAYSTACK_DVA_TRANSACTION_SELECT =
  'id,amount,currency,merchant_id,metadata,order_id,platform_fee,gateway_reference';

export type AgenticPaystackDvaTransaction = {
  amount: number | null;
  currency: string | null;
  gateway_reference: string | null;
  id: string;
  merchant_id: string;
  metadata: Record<string, unknown> | null;
  order_id: string | null;
  platform_fee: number | null;
};

export function normalizeAgenticPaystackDvaTransaction(
  value: unknown
): AgenticPaystackDvaTransaction {
  const record = toRecord(value);
  const id = normalizeRequiredIdentifier(record.id, 'transaction id');
  const merchantId = normalizeRequiredIdentifier(
    record.merchant_id,
    'transaction merchant id'
  );
  return {
    amount: normalizeNullableNumber(record.amount),
    currency: typeof record.currency === 'string' ? record.currency : null,
    gateway_reference: normalizeNullableString(record.gateway_reference),
    id,
    merchant_id: merchantId,
    metadata: toNullableRecord(record.metadata),
    order_id: typeof record.order_id === 'string' ? record.order_id : null,
    platform_fee: normalizeNullableNumber(record.platform_fee),
  };
}

function normalizeRequiredIdentifier(value: unknown, field: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`Missing ${field}`);
  }
  const normalized = String(value).trim();
  if (!normalized) {
    throw new Error(`Missing ${field}`);
  }
  return normalized;
}

function normalizeNullableNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toNullableRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
