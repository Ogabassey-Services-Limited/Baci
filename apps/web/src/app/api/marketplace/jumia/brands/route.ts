import { type NextRequest, NextResponse } from 'next/server';
import { JumiaClient } from '@/lib/jumia/client';

export async function GET(req: NextRequest) {
  try {
    // Next.js 16/15 pattern: handle searchParams safely during prerender
    const { searchParams } = new URL(req.url);
    const merchantId = searchParams.get('merchantId');

    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant ID is required' },
        { status: 400 }
      );
    }

    const jumia = await JumiaClient.forMerchant(merchantId);
    if (!jumia) {
      return NextResponse.json([]);
    }

    const brands = await jumia.getBrands();
    return NextResponse.json(brands);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('prerendering') ||
        error.message.includes('dynamic server usage'))
    ) {
      throw error;
    }
    console.error('Jumia Brands Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}
