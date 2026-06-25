import { type NextRequest, NextResponse } from 'next/server';
import { billersQuerySchema } from '@/schemas/vtu';
import {
  type BillersResponsePayload,
  getMonnifyCategoryCode,
} from './biller-normalizers';
import {
  getErrorMessage,
  loadKudaBillers,
  loadMonnifyBillers,
} from './biller-route-helpers';

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
      includeMonnify: searchParams.get('includeMonnify') ?? undefined,
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

    const type = parsed.data.type;
    const includeMonnify = parsed.data.includeMonnify;
    const monnifyCategory = includeMonnify
      ? getMonnifyCategoryCode(type)
      : undefined;

    const [{ billers: kudaBillers, error: kudaError }, monnifyResult] =
      await Promise.all([
        loadKudaBillers(type),
        monnifyCategory
          ? loadMonnifyBillers({ monnifyCategory, type })
          : Promise.resolve({ billers: [], error: null }),
      ]);

    const monnifyBillers = monnifyResult.billers;
    const monnifyError = monnifyResult.error;
    const mergedBillers = [...kudaBillers, ...monnifyBillers];

    if (mergedBillers.length === 0) {
      const providerError = kudaError ?? monnifyError;
      if (providerError) {
        return NextResponse.json(
          {
            error: `Failed to fetch billers: ${providerError.message}`,
            kudaError: getErrorMessage(kudaError),
            monnifyError: getErrorMessage(monnifyError),
          },
          { status: 500 }
        );
      }
    }

    const payload: BillersResponsePayload = { billers: mergedBillers };
    if (kudaBillers.length === 0 && kudaError) {
      payload.kudaError = kudaError.message;
    }
    if (monnifyCategory && monnifyBillers.length === 0 && monnifyError) {
      payload.monnifyError = monnifyError.message;
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to fetch billers:', message, error);
    return NextResponse.json(
      { error: `Failed to fetch billers: ${message}` },
      { status: 500 }
    );
  }
}
