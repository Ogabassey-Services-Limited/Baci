import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidateMerchantFeed } from '@/lib/cache-revalidation';

const RevalidateSchema = z.object({
  identifier: z.string().min(1),
});

/**
 * On-demand revalidation for the Google Merchant feed cache.
 *
 * Called by the VPS backfill script after populating `product_feed_images`.
 * Busts the `unstable_cache` entries so the next feed request picks up
 * the fresh manifest data immediately.
 *
 * Auth: Bearer token must match CRON_SECRET.
 *
 * Usage:
 *   POST /api/feed/google-merchant/revalidate
 *   Authorization: Bearer <CRON_SECRET>
 *   Body: { "identifier": "ogabassey" }
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
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
      { error: 'identifier is required' },
      { status: 400 }
    );
  }

  const { identifier } = parsed.data;

  try {
    revalidateMerchantFeed(identifier);
    return NextResponse.json({ revalidated: true, identifier });
  } catch (error) {
    console.error('GOOGLE_MERCHANT_REVALIDATE_ERROR:', error);
    return NextResponse.json(
      { error: 'Failed to revalidate feed' },
      { status: 500 }
    );
  }
}
