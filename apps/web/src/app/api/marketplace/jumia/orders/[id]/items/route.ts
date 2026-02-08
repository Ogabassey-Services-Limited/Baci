import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { JumiaClient } from '@/lib/jumia/client';
import { logger } from '@/lib/logger';
import { jumiaOrderIdParamSchema } from '@/schemas/marketplace';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Params are now Promises in Next.js 15+, handling compatible way
) {
  try {
    const parsedParams = jumiaOrderIdParamSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
    }
    const { id } = parsedParams.data;

    // Auth Check
    const auth = await authenticateApiRequest(request);
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
    logger.error({ message: 'Jumia Order Items Error', error });
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}
