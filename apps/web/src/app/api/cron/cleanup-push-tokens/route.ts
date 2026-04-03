import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('Authorization');
  const expectedToken = `Bearer ${cronSecret}`;
  if (!authHeader || !constantTimeEqual(authHeader, expectedToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const [
    { data: staleTokens, error: staleTokensError },
    { data: attempts, error: attemptsError },
  ] = await Promise.all([
    supabase.rpc('cleanup_stale_push_tokens'),
    supabase.rpc('cleanup_old_push_attempts'),
  ]);

  if (staleTokensError || attemptsError) {
    const error = staleTokensError ?? attemptsError;
    console.error('Push notification cleanup failed:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Push cleanup failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    cleanedTokens: staleTokens ?? 0,
    cleanedAttempts: attempts ?? 0,
  });
}
