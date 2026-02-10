import { type NextRequest, NextResponse } from 'next/server';
import { getBillersByCategory } from '@/lib/kuda-bills';
import { billersQuerySchema } from '@/schemas/vtu';

/**
 * GET /api/vtu/billers?type=electricity
 * Returns available billers/providers for a given bill category.
 * Public endpoint — customers need to see billers before purchasing.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = billersQuerySchema.safeParse({
      type: searchParams.get('type'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid bill type',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const billers = await getBillersByCategory(parsed.data.type);

    return NextResponse.json(
      { billers },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to fetch billers:', message, error);
    return NextResponse.json(
      { error: `Failed to fetch billers: ${message}` },
      { status: 500 }
    );
  }
}
