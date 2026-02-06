import { NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { JumiaClient } from '@/lib/jumia/client';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> } // Params are now Promises in Next.js 15+, handling compatible way
) {
  try {
    const { id } = await params;

    // Auth Check
    const auth = await authenticateApiRequest(_request as Request);
    if (auth.error || !auth.user || !auth.supabase)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId)
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 403 }
      );

    const jumiaClient = await JumiaClient.forMerchant(merchantId, {
      supabase: auth.supabase,
    });
    if (!jumiaClient) {
      return NextResponse.json(
        { error: 'Jumia integration not found' },
        { status: 404 }
      );
    }

    const items = await jumiaClient.getOrderItems(id);

    return NextResponse.json({ items });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch items';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
