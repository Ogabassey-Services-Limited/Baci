import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { verifyBillCustomer as verifyKudaCustomer } from '@/lib/kuda-bills';
import { verifyBillCustomer as verifyMonnifyCustomer } from '@/lib/monnify-bills';
import { verifySchema } from '@/schemas/vtu';

/**
 * POST /api/vtu/verify
 * Verifies a customer before bill purchase (meter number, smart card, etc.).
 * Public endpoint — customers verify before purchasing.
 */
export async function POST(request: Request) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request as NextRequest);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const body = await request.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      provider,
      billerCode,
      productCode,
      customerIdentifier,
      billItemIdentifier,
    } = parsed.data;

    const result =
      provider === 'monnify'
        ? await verifyMonnifyCustomer(
            billerCode ?? '',
            productCode ?? '',
            customerIdentifier
          )
        : await verifyKudaCustomer(
            billItemIdentifier ?? '',
            customerIdentifier
          );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Customer verification failed:', error);
    return NextResponse.json(
      {
        verified: false,
        message: 'Verification failed. Please try again.',
      },
      { status: 500 }
    );
  }
}
