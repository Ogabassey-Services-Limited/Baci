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

  let staleTokens: number | null = null;
  let attempts: number | null = null;

  try {
    const [staleResult, attemptsResult] = await Promise.all([
      supabase.rpc('cleanup_stale_push_tokens'),
      supabase.rpc('cleanup_old_push_attempts'),
    ]);

    if (staleResult.error || attemptsResult.error) {
      if (staleResult.error) {
        console.error('Stale tokens cleanup failed:', staleResult.error);
      }
      if (attemptsResult.error) {
        console.error('Old attempts cleanup failed:', attemptsResult.error);
      }
      return NextResponse.json(
        {
          error: 'Push cleanup failed',
          details: {
            staleTokens: staleResult.error?.message,
            attempts: attemptsResult.error?.message,
          },
        },
        { status: 500 }
      );
    }

    staleTokens = staleResult.data;
    attempts = attemptsResult.data;
  } catch (err) {
    console.error('Push notification cleanup rejected:', err);
    return NextResponse.json(
      { error: 'Push cleanup failed unexpectedly' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    cleanedTokens: staleTokens ?? 0,
    cleanedAttempts: attempts ?? 0,
  });
}
