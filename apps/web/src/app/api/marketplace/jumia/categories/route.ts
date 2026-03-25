import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { getAllCategories } from '@/lib/jumia/catalog';
import { JumiaClient } from '@/lib/jumia/client';
import { logger } from '@/lib/logger';
import { jumiaMerchantIdQuerySchema } from '@/schemas/marketplace';

export async function GET(req: NextRequest) {
  try {
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

    const jumiaClient = await JumiaClient.forMerchant(
      auth.supabase,
      merchantId
    );
    if (!jumiaClient) {
      return NextResponse.json({ categories: [], configured: false });
    }

    const categories = await getAllCategories(jumiaClient);
    return NextResponse.json({ categories, configured: true });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('prerendering') ||
        error.message.includes('dynamic server usage'))
    ) {
      throw error;
    }
    logger.error({ message: 'Jumia Categories Error', error });
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
