import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import {
  revalidateBlogPosts,
  revalidateCategories,
  revalidateFeatures,
  revalidateMerchant,
  revalidatePageConfig,
  revalidateProducts,
  revalidateReviews,
} from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';

/**
 * Cache Revalidation API
 *
 * POST /api/cache/revalidate
 * Allows authenticated merchants to manually purge cached data for their store.
 * Useful after bulk imports, external data changes, or debugging stale data.
 */

const revalidateSchema = z.object({
  // Which entity types to revalidate
  targets: z
    .array(
      z.enum([
        'products',
        'categories',
        'merchant',
        'blog',
        'reviews',
        'features',
        'pages',
        'all',
      ])
    )
    .min(1, 'At least one target is required'),
});

export async function POST(request: NextRequest) {
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid && response) return response;

  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const access = await getUserAccess(auth.supabase);
  if (!access) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  // Only merchant owners/admins can purge cache
  if (!hasPermission(access, 'settings', 'edit')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = await request.json();
  const result = revalidateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { targets } = result.data;
  const merchantId = access.merchantId;
  const revalidated: string[] = [];

  const shouldRevalidate = (target: string) =>
    targets.includes('all') || targets.includes(target as (typeof targets)[0]);

  if (shouldRevalidate('products')) {
    revalidateProducts(merchantId);
    revalidated.push('products');
  }

  if (shouldRevalidate('categories')) {
    revalidateCategories(merchantId);
    revalidated.push('categories');
  }

  if (shouldRevalidate('merchant')) {
    revalidateMerchant(merchantId);
    revalidated.push('merchant');
  }

  if (shouldRevalidate('blog')) {
    revalidateBlogPosts(merchantId);
    revalidated.push('blog');
  }

  if (shouldRevalidate('reviews')) {
    revalidateReviews(merchantId);
    revalidated.push('reviews');
  }

  if (shouldRevalidate('features')) {
    revalidateFeatures(merchantId);
    revalidated.push('features');
  }

  if (shouldRevalidate('pages')) {
    revalidatePageConfig(merchantId);
    revalidated.push('pages');
  }

  return NextResponse.json({
    success: true,
    revalidated,
    message: `Cache purged for: ${revalidated.join(', ')}`,
  });
}
