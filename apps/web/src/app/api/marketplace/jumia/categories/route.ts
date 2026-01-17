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
      // Return empty if not connected, or error? Empty is safer for UI
      return NextResponse.json([]);
    }

    const categories = await jumia.getCategoryTree();
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Jumia Categories Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
