import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type { Database } from '@/types/supabase';

type GiglTrackingRpcClient = Pick<SupabaseClient<Database>, 'rpc'>;

const EXPECTED_DATABASE_USER_PREFIX = 'gigl_tracking_worker.';
const EXPECTED_POOLER_SUFFIX = '.pooler.supabase.com';
const SUPABASE_CA_SHA256 =
  '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7';

function getPinnedSupabaseCa(repoDirValue: string | undefined): string | null {
  const repoDir = repoDirValue?.trim();
  if (!repoDir?.startsWith('/')) return null;
  try {
    const certificate = readFileSync(
      join(repoDir, 'vps-workers/certs/supabase-prod-ca-2021.crt'),
      'utf8'
    );
    const digest = createHash('sha256').update(certificate).digest('hex');
    return digest === SUPABASE_CA_SHA256 ? certificate : null;
  } catch {
    return null;
  }
}

function getValidatedDatabaseUrl(
  value: string | undefined,
  supabaseUrlValue: string | undefined
): string | null {
  try {
    const url = new URL(value?.trim() ?? '');
    const supabaseUrl = new URL(supabaseUrlValue?.trim() ?? '');
    const projectRef = supabaseUrl.hostname.match(
      /^([a-z0-9]+)\.supabase\.co$/
    )?.[1];
    if (
      !projectRef ||
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.username !== `${EXPECTED_DATABASE_USER_PREFIX}${projectRef}` ||
      !url.password ||
      !url.hostname.endsWith(EXPECTED_POOLER_SUFFIX) ||
      url.port !== '5432' ||
      url.pathname !== '/postgres'
    ) {
      return null;
    }
    // The Pool's explicit verified-TLS configuration is authoritative.
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return null;
  }
}

function getRpcQuery(
  functionName: string,
  args: Readonly<Record<string, unknown>>
) {
  switch (functionName) {
    case 'claim_due_gigl_tracking_monitors':
      return {
        params: [args.p_limit, args.p_worker_id],
        text: 'select * from public.gigl_worker_claim_due_tracking_monitors($1, $2)',
      };
    case 'apply_gigl_tracking_result':
      return {
        params: [
          args.p_shipment_id,
          args.p_tracking_epoch_id,
          args.p_worker_id,
          args.p_status,
          args.p_current_location,
          args.p_actual_delivery,
          JSON.stringify(args.p_events),
        ],
        text: 'select public.gigl_worker_apply_tracking_result($1, $2, $3, $4, $5, $6, $7::jsonb) as result',
      };
    case 'record_gigl_tracking_failure':
      return {
        params: [
          args.p_shipment_id,
          args.p_tracking_epoch_id,
          args.p_worker_id,
          args.p_error,
        ],
        text: 'select public.gigl_worker_record_tracking_failure($1, $2, $3, $4) as result',
      };
    case 'release_gigl_tracking_claim':
      return {
        params: [
          args.p_shipment_id,
          args.p_tracking_epoch_id,
          args.p_worker_id,
        ],
        text: 'select public.gigl_worker_release_tracking_claim($1, $2, $3) as result',
      };
    case 'pause_gigl_tracking_monitor':
      return {
        params: [
          args.p_shipment_id,
          args.p_tracking_epoch_id,
          args.p_worker_id,
          args.p_error,
        ],
        text: 'select public.gigl_worker_pause_tracking_monitor($1, $2, $3, $4) as result',
      };
    default:
      throw new Error('Unsupported GIGL tracking database operation');
  }
}

async function runRestrictedQuery(
  client: PoolClient,
  functionName: string,
  args: Readonly<Record<string, unknown>>
) {
  const query = getRpcQuery(functionName, args);
  await client.query('begin');
  try {
    await client.query(
      "select set_config('request.jwt.claim.role', 'gigl_tracking_worker', true)"
    );
    const result = await client.query<QueryResultRow>(query.text, query.params);
    await client.query('commit');
    if (functionName === 'claim_due_gigl_tracking_monitors') {
      return result.rows;
    }
    return result.rows[0]?.result ?? null;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }
}

/** Creates the five-operation database capability used by the VPS poller. */
export function createGiglTrackingWorkerClient(
  env: Readonly<Record<string, string | undefined>>
): GiglTrackingRpcClient {
  const connectionString = getValidatedDatabaseUrl(
    env.GIGL_TRACKING_DATABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_URL
  );
  const ca = getPinnedSupabaseCa(env.BACI_REPO_DIR);
  if (!connectionString || !ca) {
    throw new Error('GIGL tracking worker database capability is invalid');
  }

  const pool = new Pool({
    allowExitOnIdle: true,
    application_name: 'baci-gigl-tracking-worker',
    connectionString,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    max: 1,
    ssl: { ca, rejectUnauthorized: true },
  });
  pool.on('error', () => undefined);

  const rpc = (async (
    functionName: string,
    args: Readonly<Record<string, unknown>> = {}
  ) => {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      return {
        data: await runRestrictedQuery(client, functionName, args),
        error: null,
      };
    } catch {
      return {
        data: null,
        error: new Error('GIGL tracking database operation failed'),
      };
    } finally {
      client?.release();
    }
  }) as unknown as GiglTrackingRpcClient['rpc'];

  return { rpc };
}
