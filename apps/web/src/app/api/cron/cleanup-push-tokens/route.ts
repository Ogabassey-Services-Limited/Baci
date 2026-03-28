import { timingSafeEqual } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
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
  if (
    !authHeader ||
    authHeader.length !== expectedToken.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('cleanup_stale_push_tokens');

  if (error) {
    console.error('Stale push token cleanup failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cleaned: data ?? 0 });
}
