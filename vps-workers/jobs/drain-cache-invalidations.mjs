/** Direct VPS cache drainer. No request is made to the Baci Vercel deployment. */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { buildStorefrontCacheTargets } from '../lib/storefront-cache-targets.mjs';

const VERCEL_DELETE_URL =
  'https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags';
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4/zones';
const BATCH_SIZE = 5;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function validateEnvironment(env) {
  for (const name of [
    'NEXT_PUBLIC_ROOT_DOMAIN',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'VERCEL_TOKEN',
    'VERCEL_PROJECT_ID',
    'VERCEL_TEAM_ID',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ZONE_ID',
    'CLOUDFLARE_ZONE_NAME',
  ]) {
    required(env, name);
  }
}

function retryAfterSeconds(value) {
  if (!value) return undefined;
  const numeric = Number(value);
  if (Number.isFinite(numeric))
    return Math.max(0, Math.min(3600, Math.ceil(numeric)));
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.max(
    0,
    Math.min(3600, Math.ceil((timestamp - Date.now()) / 1000))
  );
}

function failure(errorCode, response) {
  const retryAfter =
    response?.status === 429
      ? retryAfterSeconds(response.headers.get('Retry-After'))
      : undefined;
  return {
    errorCode,
    ok: false,
    ...(retryAfter === undefined ? {} : { retryAfterSeconds: retryAfter }),
  };
}

export async function deliverCacheInvalidation(
  claim,
  { env = process.env, fetchImpl = fetch, timeoutMs = 5000 } = {}
) {
  const rootDomain = required(env, 'NEXT_PUBLIC_ROOT_DOMAIN').toLowerCase();
  const vercelToken = required(env, 'VERCEL_TOKEN');
  const projectId = required(env, 'VERCEL_PROJECT_ID');
  const teamId = required(env, 'VERCEL_TEAM_ID');
  const cloudflareToken = required(env, 'CLOUDFLARE_API_TOKEN');
  const zoneId = required(env, 'CLOUDFLARE_ZONE_ID');
  const zoneName = required(env, 'CLOUDFLARE_ZONE_NAME').toLowerCase();
  const { hostnames: candidateHostnames, tags } = buildStorefrontCacheTargets(
    claim,
    rootDomain
  );
  const hostnames = candidateHostnames.filter(
    (hostname) => hostname === zoneName || hostname.endsWith(`.${zoneName}`)
  );
  const query = new URLSearchParams({ projectIdOrName: projectId });
  query.set('teamId', teamId);

  for (let index = 0; index < tags.length; index += 16) {
    let response;
    try {
      response = await fetchImpl(`${VERCEL_DELETE_URL}?${query}`, {
        body: JSON.stringify({
          revalidationDeadlineSeconds: 0,
          tags: tags.slice(index, index + 16),
          target: 'production',
        }),
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return failure('vercel_request_failed');
    }
    if (!response.ok)
      return failure(`vercel_http_${response.status}`, response);
  }

  for (let index = 0; index < hostnames.length; index += 30) {
    let response;
    try {
      response = await fetchImpl(
        `${CLOUDFLARE_API_BASE}/${encodeURIComponent(zoneId)}/purge_cache`,
        {
          body: JSON.stringify({ hosts: hostnames.slice(index, index + 30) }),
          headers: {
            Authorization: `Bearer ${cloudflareToken}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          signal: AbortSignal.timeout(timeoutMs),
        }
      );
    } catch {
      return failure('cloudflare_request_failed');
    }
    if (!response.ok)
      return failure(`cloudflare_http_${response.status}`, response);
    const payload = await response.json().catch(() => null);
    if (payload?.success !== true)
      return failure('cloudflare_provider_rejected');
  }
  return { ok: true };
}

function validClaim(value) {
  const validIdentifier = (identifier) =>
    typeof identifier === 'string' &&
    identifier.trim() === identifier &&
    identifier.length >= 1 &&
    identifier.length <= 253;
  return (
    value &&
    typeof value === 'object' &&
    UUID_PATTERN.test(value.merchant_id) &&
    ['storefront_slug', 'storefront_hostname'].includes(value.target_kind) &&
    validIdentifier(value.target_id) &&
    Array.isArray(value.related_identifiers) &&
    value.related_identifiers.length <= 40 &&
    value.related_identifiers.every(validIdentifier) &&
    Array.isArray(value.product_slugs) &&
    value.product_slugs.length <= 100 &&
    value.product_slugs.every(validIdentifier) &&
    Number.isSafeInteger(value.generation) &&
    value.generation > 0 &&
    Number.isSafeInteger(value.attempts) &&
    value.attempts >= 1 &&
    value.attempts <= 20 &&
    UUID_PATTERN.test(value.claim_token)
  );
}

export async function drainCacheInvalidations({
  createSupabaseClient = createClient,
  deliver = deliverCacheInvalidation,
  env = {
    ...process.env,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  logger = console,
} = {}) {
  validateEnvironment(env);
  const supabase = createSupabaseClient(
    required(env, 'NEXT_PUBLIC_SUPABASE_URL'),
    required(env, 'SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  );
  const { data, error } = await supabase.rpc('claim_cache_invalidations', {
    p_batch_size: BATCH_SIZE,
    p_worker_id: `vps-${process.pid}`,
  });
  if (error) throw new Error('Failed to claim cache invalidations');
  if (!Array.isArray(data) || !data.every(validClaim)) {
    throw new Error('Invalid cache invalidation claim payload');
  }

  let completed = 0;
  let failed = 0;
  for (const claim of data) {
    let result;
    try {
      result = await deliver(claim, { env });
    } catch {
      result = { errorCode: 'delivery_unexpected_failure', ok: false };
    }
    let finish;
    try {
      finish = await supabase.rpc('finish_cache_invalidation', {
        p_claim_token: claim.claim_token,
        p_error_code: result.ok ? null : result.errorCode,
        p_generation: claim.generation,
        p_merchant_id: claim.merchant_id,
        p_retry_after_seconds: result.ok
          ? null
          : (result.retryAfterSeconds ?? null),
        p_succeeded: result.ok,
        p_target_id: claim.target_id,
        p_target_kind: claim.target_kind,
      });
    } catch {
      logger.log(
        `[cache-invalidations] finish-failed claimed=${data.length} completed=${completed} failed=${failed}`
      );
      throw new Error('Failed to persist cache invalidation outcome');
    }
    if (finish.error || finish.data !== true) {
      logger.log(
        `[cache-invalidations] finish-failed claimed=${data.length} completed=${completed} failed=${failed}`
      );
      throw new Error('Failed to persist cache invalidation outcome');
    }
    if (result.ok) completed += 1;
    else failed += 1;
  }
  logger.log(
    `[cache-invalidations] claimed=${data.length} completed=${completed} failed=${failed}`
  );
  return { claimed: data.length, completed, failed };
}

async function main() {
  config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
  try {
    await drainCacheInvalidations();
  } catch (error) {
    console.error('[cache-invalidations] Worker failed:', error);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
