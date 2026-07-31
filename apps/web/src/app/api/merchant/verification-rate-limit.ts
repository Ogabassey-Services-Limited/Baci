import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function getVerificationRateLimitError(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  maxRequests: number
): Promise<NextResponse | null> {
  let allowed: boolean;
  try {
    allowed = await checkRateLimit(supabase, userId, endpoint, maxRequests, 1);
  } catch (error) {
    console.error('Verification rate limit check failed:', error);
    return NextResponse.json(
      {
        error: 'Verification is temporarily unavailable',
        code: 'verification_rate_limit_unavailable',
      },
      { status: 503 }
    );
  }

  return allowed
    ? null
    : NextResponse.json(
        { error: 'Rate limit exceeded', code: 'rate_limited' },
        { status: 429 }
      );
}
