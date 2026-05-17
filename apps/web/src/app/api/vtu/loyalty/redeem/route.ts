import { NextResponse } from 'next/server';

export function POST() {
  return NextResponse.json(
    {
      error: 'VTU airtime reward redemption is temporarily disabled',
      code: 'VTU_LOYALTY_REDEMPTION_DISABLED',
    },
    { status: 410 }
  );
}
