import { type NextRequest, NextResponse } from 'next/server';
import { JumiaClient } from '@/lib/jumia/client';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
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
    console.error('Jumia Brands Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}
