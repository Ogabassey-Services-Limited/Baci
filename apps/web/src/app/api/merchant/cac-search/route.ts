import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, getUserAccess } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { cacSearchSchema } from '@/schemas/verification';

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
    const cacResponse = await fetch(
      'https://icrp.cac.gov.ng/name_similarity_app/api/public_search/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Origin: 'https://icrp.cac.gov.ng',
          Referer: 'https://icrp.cac.gov.ng/public-search',
        },
        body: JSON.stringify({ searchTerm: parsed.data.searchTerm }),
      }
    );

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
