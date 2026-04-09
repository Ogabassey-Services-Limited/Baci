import { type NextRequest, NextResponse } from 'next/server';
import { getMonnifyBaseUrl } from '@/env';
import { authenticateApiRequest, getUserAccess } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMonnifyToken } from '@/lib/monnify';
import { checkRateLimit } from '@/lib/rate-limiter';
import { ninVerifySchema } from '@/schemas/verification';
import type { MonnifyNINResponse } from '@/types/monnify';

function normalizeNameParts(name: string): string[] {
  return name.trim().toUpperCase().split(/\s+/).filter(Boolean).sort();
}

function namesMatch(
  inputFirst: string,
  inputLast: string,
  returnedFirst: string,
  returnedLast: string
): boolean {
  const inputParts = normalizeNameParts(`${inputFirst} ${inputLast}`);
  const returnedParts = normalizeNameParts(`${returnedFirst} ${returnedLast}`);

  // Exact sorted-word match handles "John Doe" vs "Doe John"
  if (inputParts.join(' ') === returnedParts.join(' ')) return true;

  // Subset match: all input words present in returned words (handles middle names)
  // Require at least 2 matching parts to avoid single-word false positives
  if (inputParts.length < 2) return false;
  return inputParts.every((w) => returnedParts.includes(w));
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
    'verify-nin',
    3,
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

  const parsed = ninVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { nin, firstName, lastName, dateOfBirth } = parsed.data;

  try {
    const token = await getMonnifyToken();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let monnifyRes: Response;
    try {
      monnifyRes = await fetch(
        `${getMonnifyBaseUrl()}/api/v1/vas/nin-details`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ nin }),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!monnifyRes.ok) {
      throw new Error(`Monnify NIN lookup failed: ${monnifyRes.status}`);
    }

    const data = (await monnifyRes.json()) as MonnifyNINResponse;

    if (!data.responseBody) {
      console.error('verify-nin: unexpected Monnify response structure');
      return NextResponse.json(
        { error: 'NIN verification service returned invalid data' },
        { status: 502 }
      );
    }

    const retFirst = data.responseBody.firstName ?? '';
    const retLast = data.responseBody.lastName ?? '';

    const verified = namesMatch(firstName, lastName, retFirst, retLast);

    if (verified) {
      const { error: rpcError } = await auth.supabase.rpc(
        'record_nin_verification',
        {
          p_merchant_id: access.merchantId,
          p_nin: nin,
          p_first_name: firstName,
          p_last_name: lastName,
          p_date_of_birth: dateOfBirth,
        }
      );

      if (rpcError) {
        console.error('record_nin_verification RPC error:', {
          code: rpcError.code,
          message: rpcError.message,
          merchantId: access.merchantId,
        });
        return NextResponse.json(
          { error: 'Failed to record verification' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ verified });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    console.error(
      `verify-nin error${isTimeout ? ' (timeout)' : ''}:`,
      err instanceof Error ? err.message : 'Unknown error'
    );
    return NextResponse.json(
      {
        error: isTimeout
          ? 'NIN verification timed out'
          : 'NIN verification failed',
      },
      { status: 500 }
    );
  }
}
