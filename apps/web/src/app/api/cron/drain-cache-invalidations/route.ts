import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { drainStorefrontCacheInvalidation } from '@/lib/drain-storefront-cache-invalidation';
import { createServiceClient } from '@/lib/supabase/service';
import { cacheInvalidationClaimSchema } from '@/schemas/cache-invalidation-claim';

export const maxDuration = 60;
const BATCH_SIZE = 5;
const claimsSchema = z.array(cacheInvalidationClaimSchema).max(BATCH_SIZE);

export async function GET(request: Request): Promise<NextResponse> {
  if (!hasValidCronSecret(request.headers, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient('event-pipeline');
  const { data, error } = await supabase.rpc('claim_cache_invalidations', {
    p_batch_size: BATCH_SIZE,
    p_worker_id: `next-cron-${Date.now()}`,
  });
  if (error) {
    return NextResponse.json(
      { error: 'Failed to claim invalidations' },
      { status: 500 }
    );
  }
  const parsed = claimsSchema.safeParse(data ?? []);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid claim payload' },
      { status: 500 }
    );
  }

  let completed = 0;
  let failed = 0;
  for (const claim of parsed.data) {
    const result = await drainStorefrontCacheInvalidation(claim);
    const finish = await supabase.rpc('finish_cache_invalidation', {
      p_claim_token: claim.claim_token,
      p_error_code: result.ok ? null : result.errorCode,
      p_generation: claim.generation,
      p_merchant_id: claim.merchant_id,
      p_retry_after_seconds:
        result.ok || result.retryAfterSeconds === undefined
          ? null
          : result.retryAfterSeconds,
      p_succeeded: result.ok,
      p_target_id: claim.target_id,
      p_target_kind: claim.target_kind,
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

  return NextResponse.json({ claimed: parsed.data.length, completed, failed });
}
