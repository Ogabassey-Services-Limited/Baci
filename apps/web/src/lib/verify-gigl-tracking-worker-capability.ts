import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type GiglTrackingRpcClient = Pick<SupabaseClient<Database>, 'rpc'>;

/** Proves the signed worker can reach its wrapper without claiming any work. */
export async function verifyGiglTrackingWorkerCapability(
  client: GiglTrackingRpcClient
): Promise<boolean> {
  const { error } = await client.rpc('claim_due_gigl_tracking_monitors', {
    p_limit: 0,
    p_worker_id: 'gigl-capability-preflight',
  });
  return error?.code === '22023';
}
