export interface IdempotencyRow {
  route: string | null;
  status_code: number | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface RequestRow {
  api_version: string | null;
  created_at: string;
  expires_at: string;
  route: string | null;
}

export interface CheckoutSessionRow {
  session_id: string;
  status: string | null;
  metadata: unknown;
  updated_at: string;
}

export function getAgenticPaymentState(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const agentic = (metadata as { agentic?: unknown }).agentic;
  if (!agentic || typeof agentic !== 'object') return null;
  const state = (agentic as { payment_state?: unknown }).payment_state;
  return typeof state === 'string' && state.trim() ? state.trim() : null;
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item)
  );
}

function getNullableString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function getString(row: Record<string, unknown>, key: string): string {
  return getNullableString(row, key) ?? '';
}

function getNullableNumber(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseAgenticActionHealthRpcPayload(value: unknown) {
  const payload =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    idempotencyRows: toRecordArray(payload.idempotency_records).map((row) => ({
      created_at: getString(row, 'created_at'),
      expires_at: getString(row, 'expires_at'),
      route: getNullableString(row, 'route'),
      status_code: getNullableNumber(row, 'status_code'),
      updated_at: getString(row, 'updated_at'),
    })),
    requestRows: toRecordArray(payload.request_records).map((row) => ({
      api_version: getNullableString(row, 'api_version'),
      created_at: getString(row, 'created_at'),
      expires_at: getString(row, 'expires_at'),
      route: getNullableString(row, 'route'),
    })),
    sessionRows: toRecordArray(payload.checkout_sessions).map((row) => ({
      metadata: row.metadata,
      session_id: getString(row, 'session_id'),
      status: getNullableString(row, 'status'),
      updated_at: getString(row, 'updated_at'),
    })),
  };
}
