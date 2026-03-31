import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidateMerchantFeed } from '@/lib/cache-revalidation';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import {
  isUuid,
  MerchantNotFoundError,
  resolveFeedMerchant,
} from '@/lib/feed-identifier';

const RevalidateSchema = z
  .object({
    merchant_id: z.string().uuid().optional(),
    identifier: z.string().min(1).optional(),
  })
  .refine((data) => data.merchant_id || data.identifier, {
    message: 'merchant_id or identifier is required',
  });

/**
 * Resolve parsed request body to canonical merchant UUID.
 * merchant_id takes precedence; legacy identifier falls back to slug resolution.
 */
async function resolveCanonicalMerchantId(
  merchantIdParam: string | undefined,
  identifier: string | undefined
): Promise<string> {
  if (merchantIdParam) return merchantIdParam;
  if (identifier && isUuid(identifier)) return identifier;
  if (identifier) {
    const merchant = await resolveFeedMerchant(identifier, true);
    return merchant.id;
  }
  // Schema refine guarantees at least one field is present
  throw new Error('merchant_id or identifier is required');
}

/**
 * On-demand revalidation for feed caches (Google Merchant + OpenAI).
 *
 * Called by the VPS backfill script after populating `product_feed_images`.
 * Busts the cache entries so the next feed request picks up
 * the fresh manifest data immediately.
 *
 * Auth: Bearer token must match CRON_SECRET.
 * CSRF: Exempt — this is a machine-to-machine endpoint (no browser clients).
 *
 * Usage:
 *   POST /api/feed/google-merchant/revalidate
 *   Authorization: Bearer <CRON_SECRET>
 *   Body: { "merchant_id": "uuid" }           (preferred)
 *   Body: { "identifier": "ogabassey" }        (legacy — slug or UUID)
 *   Body: { "merchant_id": "uuid", "identifier": "ogabassey" }  (merchant_id wins)
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !constantTimeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RevalidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'merchant_id or identifier is required' },
      { status: 400 }
    );
  }

  const { merchant_id: merchantIdParam, identifier } = parsed.data;

  try {
    const merchantId = await resolveCanonicalMerchantId(
      merchantIdParam,
      identifier
    );

    revalidateMerchantFeed(merchantId);
    return NextResponse.json({ revalidated: true, merchant_id: merchantId });
  } catch (error) {
    console.error('FEED_REVALIDATE_ERROR:', error);
    if (error instanceof MerchantNotFoundError) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to revalidate feed' },
      { status: 500 }
    );
  }
}
