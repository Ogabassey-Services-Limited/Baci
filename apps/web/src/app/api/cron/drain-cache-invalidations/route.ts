import { NextResponse } from 'next/server';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { drainStorefrontCacheInvalidation } from '@/lib/drain-storefront-cache-invalidation';
import { createServiceClient } from '@/lib/supabase/service';
import { cacheInvalidationDrainCronResponseSchemas } from '@/schemas/cache-invalidation-drain-cron';

export const maxDuration = 60;
const BATCH_SIZE = 2;
const TARGET_BUDGET = 10;
const CLAIM_CUTOFF_MS = 30_000;
export async function GET(request: Request): Promise<NextResponse> {
  if (!hasValidCronSecret(request.headers, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const workerId = `next-cron-${startedAt}`;
  const supabase = createServiceClient('event-pipeline');
  let claimed = 0;
  let completed = 0;
  let failed = 0;
  while (claimed < TARGET_BUDGET && Date.now() - startedAt < CLAIM_CUTOFF_MS) {
    const { data, error } = await supabase.rpc('claim_cache_invalidations', {
      p_batch_size: Math.min(BATCH_SIZE, TARGET_BUDGET - claimed),
      p_worker_id: workerId,
    });
    if (error) {
      return NextResponse.json(
        { error: 'Failed to claim invalidations' },
        { status: 500 }
      );
    }
    const parsed = cacheInvalidationDrainCronResponseSchemas.claims.safeParse(
      data ?? []
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid claim payload' },
        { status: 500 }
      );
    }
    if (parsed.data.length === 0) break;

    claimed += parsed.data.length;
    for (const claim of parsed.data) {
      let result: Awaited<ReturnType<typeof drainStorefrontCacheInvalidation>>;
      try {
        result = await drainStorefrontCacheInvalidation(claim);
      } catch {
        result = { errorCode: 'drain_unexpected_failure', ok: false };
      }
      const finish = await supabase.rpc('finish_cache_invalidation', {
        p_claim_token: claim.claim_token,
        p_generation: claim.generation,
        p_merchant_id: claim.merchant_id,
        p_succeeded: result.ok,
        p_target_id: claim.target_id,
        p_target_kind: claim.target_kind,
        ...(result.ok ? {} : { p_error_code: result.errorCode }),
        ...(result.ok || result.retryAfterSeconds === undefined
          ? {}
          : { p_retry_after_seconds: result.retryAfterSeconds }),
      });
      if (finish.error || finish.data !== true) {
        return NextResponse.json(
          { error: 'Failed to persist invalidation outcome' },
          { status: 500 }
        );
      }
      if (result.ok) completed += 1;
      else failed += 1;
    }
  }

  const deadLetterResult = await supabase.rpc(
    'has_cache_invalidation_dead_letters'
  );
  const deadLetters =
    cacheInvalidationDrainCronResponseSchemas.deadLetters.safeParse(
      deadLetterResult.data
    );
  if (deadLetterResult.error || !deadLetters.success) {
    return NextResponse.json(
      { error: 'Failed to read invalidation alert state' },
      { status: 500 }
    );
  }
  if (deadLetters.data) {
    return NextResponse.json(
      {
        error: 'Cache invalidations require intervention',
        code: 'cache_invalidation_dead_letter',
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ claimed, completed, failed });
}
