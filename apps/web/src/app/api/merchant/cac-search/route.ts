import { type NextRequest, NextResponse } from 'next/server';
import { getCacApiUrl } from '@/env';
import { authenticateApiRequest, getUserAccess } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rate-limiter';
import { cacSearchSchema } from '@/schemas/verification';

function normalizeCacSearchTerm(searchTerm: string): string {
  const trimmed = searchTerm.trim();
  const prefixedRegistrationMatch = trimmed.match(/^(rc|bn)\s*-?\s*(\d+)$/i);

  if (prefixedRegistrationMatch) {
    return prefixedRegistrationMatch[2];
  }

  return trimmed;
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
    const normalizedSearchTerm = normalizeCacSearchTerm(parsed.data.searchTerm);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let cacResponse: Response;
    try {
      // CAC's public search API validates Origin/Referer/User-Agent to block
      // non-browser callers. These values intentionally mimic a browser request.
      // If CAC requests start failing, check whether they changed validation
      // rules and update these headers accordingly.
      cacResponse = await fetch(getCacApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Origin: 'https://icrp.cac.gov.ng',
          Referer: 'https://icrp.cac.gov.ng/public-search',
        },
        body: JSON.stringify({ searchTerm: normalizedSearchTerm }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!cacResponse.ok) {
      return NextResponse.json(
        { error: 'CAC search service unavailable' },
        { status: 502 }
      );
    }

    const data = (await cacResponse.json()) as {
      data?: unknown[];
      success?: boolean;
    };
    const companies = Array.isArray(data?.data) ? data.data : [];
    return NextResponse.json({ companies });
  } catch (err) {
    console.error('CAC search error:', err);
    return NextResponse.json({ error: 'CAC search failed' }, { status: 500 });
  }
}
