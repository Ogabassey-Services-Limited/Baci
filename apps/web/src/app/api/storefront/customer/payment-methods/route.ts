import { type NextRequest, NextResponse } from 'next/server';
import {
  getSavingsIdentifierParams,
  resolveCustomerSavingsContext,
} from '@/app/api/storefront/customer/savings/shared';
import { authenticateApiRequest } from '@/lib/api-auth';
import { listSavedPaymentMethods } from '@/lib/customer-saved-payment-methods';
import { customerPaymentMethodsQuerySchema } from '@/schemas/customer-savings';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const parsed = customerPaymentMethodsQuerySchema.safeParse(
      getSavingsIdentifierParams(new URL(request.url).searchParams)
    );
    if (!parsed.success) {
      console.error('Invalid payment methods query', parsed.error.flatten());
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', error: 'Invalid request' },
        { status: 400 }
      );
    }

    const resolved = await resolveCustomerSavingsContext({
      identifiers: parsed.data,
      supabase: auth.supabase,
      user: auth.user,
    });
    if ('response' in resolved) {
      return resolved.response;
    }

    const methods = await listSavedPaymentMethods({
      customerId: resolved.customer.id,
      merchantId: resolved.merchant.id,
      supabase: resolved.supabase,
    });

    return NextResponse.json({ methods });
  } catch (error) {
    console.error('Failed to fetch storefront customer payment methods', error);
    return NextResponse.json(
      {
        code: 'PAYMENT_METHODS_FETCH_FAILED',
        error: 'Failed to fetch payment methods',
      },
      { status: 500 }
    );
  }
}
