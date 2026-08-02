import { NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { runPetrockReconciliation } from '@/lib/imei-providers/petrock/run-petrock-reconciliation';

export async function GET(request: Request) {
  if (!hasValidCronSecret(request.headers, getCronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runPetrockReconciliation({
    origin: new URL(request.url).origin,
  });
  return NextResponse.json(result.body, { status: result.status });
}
