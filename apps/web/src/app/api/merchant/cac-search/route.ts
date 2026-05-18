import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, getUserAccess } from '@/lib/api-auth';
import {
  type CacPublicRecordsError,
  fetchCacCompanies,
} from '@/lib/cac-public-records';
import { checkCsrfProtection } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rate-limiter';
import { cacSearchSchema } from '@/schemas/verification';

function isCacPublicRecordsError(
  error: unknown
): error is CacPublicRecordsError {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number' &&
    'code' in error &&
    typeof error.code === 'string'
  );
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json(
      { error: auth.error ?? 'Unauthorized' },
      { status: 401 }
    );
  }

  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  const access = await getUserAccess(auth.supabase);
  if (!access) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  if (!access.isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const allowed = await checkRateLimit(
    auth.supabase,
    auth.user.id,
    'cac-search',
    10,
    1
  );
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', code: 'rate_limited' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const parsed = cacSearchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const companies = await fetchCacCompanies(parsed.data.searchTerm);
    return NextResponse.json({ companies });
  } catch (err) {
    if (isCacPublicRecordsError(err)) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }

    console.error('CAC search error:', err);
    return NextResponse.json({ error: 'CAC search failed' }, { status: 500 });
  }
}
