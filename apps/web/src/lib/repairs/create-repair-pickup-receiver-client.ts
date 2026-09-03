import 'server-only';

import { createClient } from '@/lib/supabase/admin';

/**
 * Server-only client for the service_role-gated repair-pickup receiver RPC.
 * Storefront quote/payment actions must not call that projection through the
 * anonymous PostgREST role.
 */
export function createRepairPickupReceiverClient() {
  return createClient();
}
