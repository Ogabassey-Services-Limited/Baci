import { type NextRequest, NextResponse } from 'next/server';
import { getMonnifyBaseUrl } from '@/env';
import { authenticateApiRequest, getUserAccess } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMonnifyToken } from '@/lib/monnify';
import { checkRateLimit } from '@/lib/rate-limiter';
import { bvnVerifySchema } from '@/schemas/verification';
import type { MonnifyBVNMatchResponse } from '@/types/monnify';

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
    'verify-bvn',
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

  const parsed = bvnVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { bvn, firstName, lastName, dateOfBirth, mobileNo } = parsed.data;

  try {
    const token = await getMonnifyToken();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    let monnifyRes: Response;
    try {
      monnifyRes = await fetch(
        `${getMonnifyBaseUrl()}/api/v1/vas/bvn-details-match`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bvn,
            name: `${firstName} ${lastName}`,
            dateOfBirth,
            mobileNo,
          }),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!monnifyRes.ok) {
      throw new Error(`Monnify BVN check failed: ${monnifyRes.status}`);
    }

    const data = (await monnifyRes.json()) as MonnifyBVNMatchResponse;

    if (!data.responseBody) {
      console.error('verify-bvn: unexpected Monnify response structure');
      return NextResponse.json(
        { error: 'BVN verification service returned invalid data' },
        { status: 502 }
      );
    }

    const matched = data.responseBody.matchStatus === 'FULL_MATCH';

    if (matched) {
      const { error: rpcError } = await auth.supabase.rpc(
        'record_bvn_verification',
        {
          p_merchant_id: access.merchantId,
          p_bvn: bvn,
          p_first_name: firstName,
          p_last_name: lastName,
          p_date_of_birth: dateOfBirth,
        }
      );

      if (rpcError) {
        console.error('record_bvn_verification error:', rpcError);
        return NextResponse.json(
          { error: 'Failed to record verification' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ verified: matched });
  } catch (err) {
    console.error(
      'verify-bvn error:',
      err instanceof Error ? err.message : 'Unknown error'
    );
    return NextResponse.json(
      { error: 'BVN verification failed' },
      { status: 500 }
    );
  }
}
