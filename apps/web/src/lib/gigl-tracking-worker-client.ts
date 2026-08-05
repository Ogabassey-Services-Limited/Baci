import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const EXPECTED_WORKER_ROLE = 'gigl_tracking_worker';
const RESTRICTED_RPC_NAMES: Readonly<Record<string, string>> = {
  apply_gigl_tracking_result: 'gigl_worker_apply_tracking_result',
  claim_due_gigl_tracking_monitors: 'gigl_worker_claim_due_tracking_monitors',
  pause_gigl_tracking_monitor: 'gigl_worker_pause_tracking_monitor',
  record_gigl_tracking_failure: 'gigl_worker_record_tracking_failure',
  release_gigl_tracking_claim: 'gigl_worker_release_tracking_claim',
};

function hasCurrentWorkerCapability(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return false;
    const decoded: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    );
    if (!decoded || typeof decoded !== 'object') return false;
    const role = Reflect.get(decoded, 'role');
    const expiresAt = Reflect.get(decoded, 'exp');
    return (
      role === EXPECTED_WORKER_ROLE &&
      typeof expiresAt === 'number' &&
      expiresAt * 1000 > Date.now() + 24 * 60 * 60 * 1000
    );
  } catch {
    return false;
  }
}

/**
 * Creates a PostgREST client whose JWT can assume only the database role
 * granted access to the five GIGL tracking wrapper procedures.
 */
export function createGiglTrackingWorkerClient(
  env: Readonly<Record<string, string | undefined>>
) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const workerToken = env.GIGL_TRACKING_WORKER_TOKEN?.trim();
  if (
    !url ||
    !anonKey ||
    !workerToken ||
    !hasCurrentWorkerCapability(workerToken)
  ) {
    throw new Error('GIGL tracking worker database capability is invalid');
  }

  const client = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { headers: { Authorization: `Bearer ${workerToken}` } },
  });
  const rpc = client.rpc.bind(client);
  client.rpc = ((
    functionName: string,
    args?: Record<string, unknown>,
    options?: {
      count?: 'exact' | 'planned' | 'estimated';
      get?: boolean;
      head?: boolean;
    }
  ) =>
    rpc(
      (RESTRICTED_RPC_NAMES[functionName] ?? functionName) as never,
      args as never,
      options
    )) as unknown as typeof client.rpc;
  return client;
}
