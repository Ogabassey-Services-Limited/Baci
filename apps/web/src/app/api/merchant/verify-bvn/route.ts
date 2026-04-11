import { type NextRequest, NextResponse } from 'next/server';
import { getMonnifyBaseUrl } from '@/env';
import { authenticateApiRequest, getUserAccess } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMonnifyToken } from '@/lib/monnify';
import { checkRateLimit } from '@/lib/rate-limiter';
import { bvnVerifySchema } from '@/schemas/verification';
import type { MonnifyBVNMatchResponse } from '@/types/monnify';

const MOBILE_REGEX = /^0\d{10}$/;
const MONNIFY_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const SAFE_MONNIFY_VALIDATION_MESSAGES = new Set([
  'Invalid date format supplied. Accepted date format - dd-MMM-yyyy',
]);

function getSafeMonnifyValidationMessage(message: string) {
  return SAFE_MONNIFY_VALIDATION_MESSAGES.has(message)
    ? message
    : 'Invalid BVN verification details provided.';
}

function formatDateOfBirthForMonnify(dateOfBirth: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    throw new Error('Invalid date of birth format');
  }

  const [year, month, day] = dateOfBirth.split('-').map(Number);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error('Invalid date of birth format');
  }

  const monthLabel = MONNIFY_MONTHS[month - 1];
  return `${String(day).padStart(2, '0')}-${monthLabel}-${year}`;
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
  const monnifyDateOfBirth = formatDateOfBirthForMonnify(dateOfBirth);

  try {
    let effectiveMobileNo = mobileNo?.trim() ?? '';

    if (!effectiveMobileNo) {
      const { data: merchantRecord, error: merchantError } = await auth.supabase
        .from('merchants')
        .select('phone')
        .eq('id', access.merchantId)
        .maybeSingle();

      if (merchantError) {
        console.error(
          'verify-bvn: failed to load merchant phone',
          merchantError
        );
        return NextResponse.json(
          { error: 'Unable to load merchant verification details' },
          { status: 500 }
        );
      }

      effectiveMobileNo = merchantRecord?.phone?.trim() ?? '';
    }

    if (!MOBILE_REGEX.test(effectiveMobileNo)) {
      return NextResponse.json(
        { error: 'Add a valid store phone number before verifying BVN' },
        { status: 400 }
      );
    }

    const token = await getMonnifyToken();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

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
            dateOfBirth: monnifyDateOfBirth,
            mobileNo: effectiveMobileNo,
          }),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!monnifyRes.ok) {
      let upstreamMessage = `Monnify BVN check failed: ${monnifyRes.status}`;

      try {
        const errorPayload = (await monnifyRes.json()) as {
          message?: string;
          responseMessage?: string;
        };
        upstreamMessage =
          errorPayload.responseMessage?.trim() ||
          errorPayload.message?.trim() ||
          upstreamMessage;
      } catch {
        // Ignore parse failures and fall back to the HTTP status message.
      }

      if (upstreamMessage.toLowerCase().includes('restricted account')) {
        return NextResponse.json(
          {
            error:
              'BVN verification is temporarily unavailable because the Monnify account is restricted.',
            code: 'bvn_verification_provider_restricted',
          },
          { status: 503 }
        );
      }

      if (monnifyRes.status === 400 || monnifyRes.status === 422) {
        return NextResponse.json(
          { error: getSafeMonnifyValidationMessage(upstreamMessage) },
          { status: 400 }
        );
      }

      if (monnifyRes.status === 401 || monnifyRes.status === 403) {
        return NextResponse.json(
          {
            error: 'BVN verification provider authentication failed.',
            code: 'bvn_verification_provider_auth_failed',
          },
          { status: 502 }
        );
      }

      if (monnifyRes.status === 429) {
        return NextResponse.json(
          {
            error: 'BVN verification is temporarily unavailable.',
            code: 'bvn_verification_provider_rate_limited',
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          error: 'BVN verification is temporarily unavailable.',
          code: 'bvn_verification_provider_unavailable',
        },
        { status: 502 }
      );
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
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown BVN verification error';
    console.error('verify-bvn error:', errorMessage);

    if (errorMessage === 'Invalid date of birth format') {
      return NextResponse.json(
        { error: 'Date of birth must use YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    if (errorMessage === 'Monnify credentials not configured') {
      return NextResponse.json(
        {
          error:
            'BVN verification is not configured on this environment yet. Add Monnify credentials to continue.',
          code: 'bvn_verification_unconfigured',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'BVN verification failed' },
      { status: 500 }
    );
  }
}
