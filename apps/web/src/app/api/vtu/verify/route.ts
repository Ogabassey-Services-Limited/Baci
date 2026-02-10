import { NextResponse } from 'next/server';
import { verifyBillCustomer } from '@/lib/kuda-bills';
import { verifySchema } from '@/schemas/vtu';

/**
 * POST /api/vtu/verify
 * Verifies a customer before bill purchase (meter number, smart card, etc.).
 * Public endpoint — customers verify before purchasing.
 */
export async function POST(request: Request) {
  try {
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

    const result = await verifyBillCustomer(
      parsed.data.billItemIdentifier,
      parsed.data.customerIdentifier
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
