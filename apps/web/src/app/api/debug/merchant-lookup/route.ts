import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';

/**
 * Debug endpoint to test merchant lookup
 * GET /api/debug/merchant-lookup
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const { user, error: authError } = await authenticateApiRequest(request);

    if (authError || !user) {
      return NextResponse.json(
        {
          step: 'auth',
          error: authError || 'Unauthorized',
          user: null,
        },
        { status: 401 }
      );
    }

    // Get merchant ID
    const merchantId = await getMerchantIdForApiUser(user.id);

    return NextResponse.json({
      step: 'complete',
      userId: user.id,
      userEmail: user.email,
      merchantId: merchantId,
      success: !!merchantId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        step: 'error',
        error: message,
      },
      { status: 500 }
    );
  }
}
