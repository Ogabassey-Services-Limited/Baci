import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { resolveAccountNumber } from '@/lib/paystack';
import {
  getPaystackFailureMessage,
  getPaystackFailureStatus,
} from '@/lib/paystack-route-errors';
import { resolvePaystackAccountSchema } from '@/schemas/paystack-resolve';

/**
 * POST /api/paystack/resolve
 * Resolves a bank account number via Paystack to return the account holder name.
 * Used by both web dashboard and mobile admin app through one shared handler.
 *
 * Accepts both camelCase and snake_case field names, but returns a single
 * snake_case response shape for all clients.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error ?? 'Unauthorized' },
        { status: 401 }
      );
    }

    const usingBearerAuth =
      request.headers.get('Authorization')?.startsWith('Bearer ') ?? false;
    if (!usingBearerAuth) {
      const csrf = await checkCsrfProtection(request);
      if (!csrf.valid) {
        return (
          csrf.response ??
          NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
        );
      }
    }

    const merchantContext = await getMerchantForApiRequest(
      auth.supabase,
      auth.user.id
    );
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const parseResult = resolvePaystackAccountSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { account_number, bank_code } = parseResult.data;
    const result = await resolveAccountNumber(account_number, bank_code);

    if (!result.success) {
      if (result.code === 'CONFIG_ERROR') {
        console.error('Paystack resolve configuration error:', result.error);
      }
      return NextResponse.json(
        {
          error: getPaystackFailureMessage(result, 'Could not resolve account'),
        },
        { status: getPaystackFailureStatus(result.code) }
      );
    }

    return NextResponse.json({
      account_name: result.data.account_name,
      account_number: result.data.account_number,
      bank_id: result.data.bank_id ?? null,
    });
  } catch (error) {
    console.error('Paystack resolve error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve account' },
      { status: 500 }
    );
  }
}
