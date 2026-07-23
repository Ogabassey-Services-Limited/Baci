import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveGrandfatheredPaymentPendingReplay } from './agentic-paystack-dva-grandfathered-response';
import { CHECKOUT_COMPLETION_IDEMPOTENCY_ROUTE } from './checkout-completion-idempotency-route';
import type { StoredCheckoutCompletionSession } from './checkout-completion-response';

const MAX_REPLAY_CANDIDATES = 25;

interface IdempotencyReplayRow {
  request_hash: unknown;
  response_body: unknown;
  status_code: unknown;
}

export async function findGrandfatheredAgenticPaystackDvaReplay({
  merchantId,
  now = new Date(),
  session,
  supabase,
}: {
  merchantId: string;
  now?: Date;
  session: StoredCheckoutCompletionSession;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from('agentic_idempotency_records')
    .select('request_hash, response_body, status_code')
    .eq('route', CHECKOUT_COMPLETION_IDEMPOTENCY_ROUTE)
    .eq('merchant_id', merchantId)
    .eq('status_code', 200)
    .gt('expires_at', now.toISOString())
    .contains('response_body', {
      id: session.session_id,
      status: 'ready_for_payment',
    })
    .order('updated_at', { ascending: false })
    .limit(MAX_REPLAY_CANDIDATES);

  if (error) return { data: null, error };

  for (const row of (data ?? []) as IdempotencyReplayRow[]) {
    const replay = resolveGrandfatheredPaymentPendingReplay({
      replay: {
        requestHash:
          typeof row.request_hash === 'string' ? row.request_hash : '',
        response: row.response_body,
        status: typeof row.status_code === 'number' ? row.status_code : 0,
      },
      session,
    });
    if (replay) return { data: replay, error: null };
  }

  return { data: null, error: null };
}
