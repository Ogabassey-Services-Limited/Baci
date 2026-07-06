import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
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
};

export async function POST(request: NextRequest) {
  // 1. Auth first.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  const { data, error } = await supabase.rpc('set_customer_username', {
    p_merchant_id: parsed.data.merchantId,
    p_username: parsed.data.username,
  });

  if (error) {
    const mapped = RPC_ERROR_RESPONSES[error.message];
    if (mapped) {
      return NextResponse.json(
        { code: mapped.code, error: mapped.error },
        { status: mapped.status }
      );
    }
    logger.error({
      message: 'set_customer_username RPC failed',
      error,
      userId: user.id,
    });
    return NextResponse.json(
      { error: 'Could not set username' },
      { status: 500 }
    );
  }

  return NextResponse.json({ username: data });
}
