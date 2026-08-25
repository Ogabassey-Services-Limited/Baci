import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { purgeExpiredJumiaSelfAuthorizationDiscoveries } from '@/lib/jumia/purge-expired-jumia-self-authorization-discoveries';
import { logger } from '@/lib/logger';
import { createAnonClient } from '@/lib/supabase/anon';

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

  try {
    const deleted = await purgeExpiredJumiaSelfAuthorizationDiscoveries(
      createAnonClient()
    );
    return NextResponse.json({ deleted });
  } catch (error) {
    logger.error({
      message: 'Failed to purge expired Jumia self-authorization discoveries',
      error,
    });
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 });
  }
}
