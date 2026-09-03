import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

interface AdminGiglQuotePersistenceInput {
  attestation: Record<string, unknown>;
  quote: Record<string, unknown>;
  /** Caller-bound client; never constructs a service-role client. */
  supabase: SupabaseClient;
}

/**
 * Persists an Admin GIGL quote through the authenticated order-scoped RPC.
 * Ownership / orders:fulfill is enforced by the SECURITY DEFINER writer.
 */
export function persistAdminGiglQuote({
  attestation,
  quote,
  supabase,
}: AdminGiglQuotePersistenceInput) {
  return supabase.rpc(
    'persist_authenticated_admin_gigl_quote' as never,
    {
      p_quote: quote,
      p_attestation: attestation,
    } as never
  ) as unknown as Promise<{
    data: string | null;
    error: { message?: string } | null;
  }>;
}
