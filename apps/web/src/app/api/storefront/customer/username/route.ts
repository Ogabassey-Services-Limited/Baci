import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { setCustomerUsernameSchema } from '@/schemas/customer-username';

// Maps the RPC's raised errcodes/messages to shopper-facing responses.
const RPC_ERROR_RESPONSES: Record<
  string,
  { code: string; error: string; status: number }
> = {
  username_taken: {
    code: 'USERNAME_TAKEN',
    error: 'That username is already taken. Try another.',
    status: 409,
  },
  reserved_username: {
    code: 'USERNAME_RESERVED',
    error: 'That username is not available.',
    status: 409,
  },
  invalid_username: {
    code: 'USERNAME_INVALID',
    error:
      'Use 3-20 letters, numbers, or single . _ separators (start and end with a letter or number).',
    status: 400,
  },
  customer_not_found: {
    code: 'CUSTOMER_NOT_FOUND',
    error: 'No shopper account found for this store.',
    status: 404,
  },
  not_authenticated: {
    code: 'UNAUTHORIZED',
    error: 'Please sign in to choose a username.',
    status: 401,
  },
  username_change_active_attempt: {
    code: 'USERNAME_CHANGE_ACTIVE_ATTEMPT',
    error: 'Finish your active quiz before changing your username.',
    status: 409,
  },
  username_change_cooldown: {
    code: 'USERNAME_CHANGE_COOLDOWN',
    error: 'You can change your username once every 30 days.',
    status: 409,
  },
};

function readTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export async function POST(request: NextRequest) {
  // 1. Auth first — bearer-aware so both mobile (Authorization header) and web
  // (cookie) storefront callers authenticate, matching sibling customer routes.
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }
  const { user, supabase } = auth;

  // 2. CSRF (skipped for mobile Bearer auth inside the helper).
  const csrf = await checkCsrfProtection(request);
  if (!csrf.valid) {
    return (
      csrf.response ??
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    );
  }

  // 3. Validate.
  const body = await request.json().catch(() => null);
  const parsed = setCustomerUsernameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // 4. Set (RPC re-derives the customer from auth.uid() + merchant and enforces
  // per-merchant case-insensitive uniqueness).
  const { data, error } = await supabase.rpc('set_customer_username_v2', {
    p_merchant_id: parsed.data.merchantId,
    p_username: parsed.data.username,
  });

  if (error) {
    const mapped = RPC_ERROR_RESPONSES[error.message];
    if (mapped) {
      const nextEligibleAt =
        error.message === 'username_change_cooldown'
          ? readTimestamp(error.details)
          : null;
      return NextResponse.json(
        {
          code: mapped.code,
          error: mapped.error,
          ...(nextEligibleAt ? { nextEligibleAt } : {}),
        },
        { status: mapped.status }
      );
    }
    logger.error({
      message: 'set_customer_username_v2 RPC failed',
      error,
      userId: user.id,
    });
    return NextResponse.json(
      { error: 'Could not set username' },
      { status: 500 }
    );
  }

  if (!data || typeof data !== 'object' || typeof data.username !== 'string') {
    logger.error({
      message: 'set_customer_username_v2 returned an invalid projection',
      userId: user.id,
    });
    return NextResponse.json(
      { error: 'Could not set username' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    nextEligibleAt: readTimestamp(data.nextEligibleAt),
    username: data.username,
    usernameChangedAt: readTimestamp(data.usernameChangedAt),
  });
}
