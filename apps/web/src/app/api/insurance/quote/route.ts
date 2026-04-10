import { type NextRequest, NextResponse } from 'next/server';
import { estimateInsurancePremium } from '@/lib/mycover';

/**
 * GET /api/insurance/quote
 *
 * Get an estimated insurance premium for a given order value.
 * This is a client-side estimate - actual premium is determined when purchasing.
 */
export function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderValueStr = searchParams.get('order_value');

    if (!orderValueStr) {
      return NextResponse.json(
        { error: 'order_value parameter is required' },
        { status: 400 }
      );
    }

    const orderValue = Number.parseFloat(orderValueStr);
    if (Number.isNaN(orderValue) || orderValue <= 0) {
      return NextResponse.json(
        { error: 'order_value must be a positive number' },
        { status: 400 }
      );
    }

    const estimate = estimateInsurancePremium(orderValue);

    return NextResponse.json({
      order_value: orderValue,
      currency: 'NGN',
      premium: {
        estimated: estimate.estimated,
        min: estimate.range.min,
        max: estimate.range.max,
      },
      note: 'Estimate only. Actual premium determined at purchase.',
      coverage: {
        description:
          'Gadget Cover V2 — device protection against accidental and liquid damage',
        provider: 'MyCover.ai (Sovereign Trust Insurance Plc)',
      },
    });
  } catch (error) {
    console.error('[Insurance Quote] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get insurance quote' },
      { status: 500 }
    );
  }
}
