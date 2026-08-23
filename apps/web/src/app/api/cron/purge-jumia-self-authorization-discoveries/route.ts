import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { purgeExpiredJumiaSelfAuthorizationDiscoveries } from '@/lib/jumia/purge-expired-jumia-self-authorization-discoveries';
import { purgeOrphanedJumiaAuthorizations } from '@/lib/jumia/purge-orphaned-jumia-authorizations';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

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
    const supabase = createServiceClient();
    const deleted =
      await purgeExpiredJumiaSelfAuthorizationDiscoveries(supabase);
    const orphaned = await purgeOrphanedJumiaAuthorizations(supabase);
    return NextResponse.json({ deleted, orphaned });
  } catch (error) {
    logger.error({
      message: 'Failed to purge expired Jumia self-authorization discoveries',
      error,
    });
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 });
  }
}
