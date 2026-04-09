import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, getUserAccess } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMonnifyToken } from '@/lib/monnify';
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

    const monnifyRes = await fetch(
      'https://api.monnify.com/api/v1/vas/nin-details',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nin }),
      }
    );

    if (!monnifyRes.ok) {
      throw new Error(`Monnify NIN lookup failed: ${monnifyRes.status}`);
    }

    const data = (await monnifyRes.json()) as MonnifyNINResponse;
    const { firstName: retFirst, lastName: retLast } = data.responseBody;

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
        console.error('record_nin_verification error:', rpcError);
        return NextResponse.json(
          { error: 'Failed to record verification' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ verified });
  } catch (err) {
    console.error('verify-nin error:', err);
    return NextResponse.json(
      { error: 'NIN verification failed' },
      { status: 500 }
    );
  }
}
