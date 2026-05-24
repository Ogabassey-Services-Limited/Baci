import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CheckoutSessionRow,
  IdempotencyRow,
  RequestRow,
} from '@/lib/agentic/action-health-rpc-payload';

const CHECKOUT_SESSION_COLUMNS = 'session_id, status, metadata, updated_at';
const IDEMPOTENCY_RECORD_COLUMNS =
  'route, status_code, created_at, updated_at, expires_at';
const REQUEST_RECORD_COLUMNS =
  'agent_id, api_version, route, created_at, expires_at';

interface AgenticActionHealthRecordsPayload {
  checkout_sessions: CheckoutSessionRow[];
  idempotency_records: IdempotencyRow[];
  request_records: RequestRow[];
}

export async function loadAdminAgenticActionHealthRecords(
  supabase: SupabaseClient,
  merchantId: string,
  recordLimit: number
): Promise<AgenticActionHealthRecordsPayload> {
  const [idempotencyResult, checkoutSessionsResult, requestRecordsResult] =
    await Promise.all([
      supabase
        .from('agentic_idempotency_records')
        .select(IDEMPOTENCY_RECORD_COLUMNS)
        .eq('merchant_id', merchantId)
        .order('updated_at', { ascending: false })
        .limit(recordLimit),
      supabase
        .from('checkout_sessions')
        .select(CHECKOUT_SESSION_COLUMNS)
        .eq('merchant_id', merchantId)
        .not('metadata->agentic', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(recordLimit),
      supabase
        .from('agentic_request_records')
        .select(REQUEST_RECORD_COLUMNS)
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(recordLimit),
    ]);

  if (idempotencyResult.error) {
    throw idempotencyResult.error;
  }

  if (checkoutSessionsResult.error) {
    throw checkoutSessionsResult.error;
  }

  if (requestRecordsResult.error) {
    throw requestRecordsResult.error;
  }

  return {
    checkout_sessions:
      (checkoutSessionsResult.data as CheckoutSessionRow[] | null) ?? [],
    idempotency_records:
      (idempotencyResult.data as IdempotencyRow[] | null) ?? [],
    request_records: (requestRecordsResult.data as RequestRow[] | null) ?? [],
  };
}
