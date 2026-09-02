import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

interface AdminGiglQuotePersistenceInput {
  attestation: Record<string, unknown>;
  quote: Record<string, unknown>;
}

/**
 * Persists an owner-scoped Admin GIGL quote through the service-role-only RPC.
 * All order and merchant reads must happen through the authenticated client;
 * this helper is intentionally limited to the trusted writer call.
 */
export function persistAdminGiglQuote({
  attestation,
  quote,
}: AdminGiglQuotePersistenceInput) {
  const admin = createAdminClient();
  return admin.rpc(
    'persist_admin_gigl_quote' as never,
    {
      p_quote: quote,
      p_attestation: attestation,
    } as never
  ) as unknown as Promise<{
    data: string | null;
    error: { message?: string } | null;
  }>;
}
