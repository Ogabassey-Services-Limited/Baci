import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { JumiaClient } from '@/lib/jumia/client';
import { logger } from '@/lib/logger';
import { jumiaMerchantIdQuerySchema } from '@/schemas/marketplace';

export async function GET(req: NextRequest) {
  try {
    // Next.js 16/15 pattern: handle searchParams safely during prerender
    const { searchParams } = new URL(req.url);
    const parsedQuery = jumiaMerchantIdQuerySchema.safeParse({
      merchantId: searchParams.get('merchantId') ?? undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Invalid merchantId', details: parsedQuery.error.flatten() },
        { status: 400 }
      );
    }
    const { merchantId: requestedMerchantId } = parsedQuery.data;

    const auth = await authenticateApiRequest(req);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (requestedMerchantId && requestedMerchantId !== merchantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const jumia = await JumiaClient.forMerchant(merchantId, {
      supabase: auth.supabase,
    });
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
    logger.error({ message: 'Jumia Brands Error', error });
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}
