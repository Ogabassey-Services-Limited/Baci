import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantBlogRevalidationContext } from '@/lib/get-merchant-blog-cache-identifiers';
import type { dispatchZohoBlogCampaign } from '@/lib/zoho-blog-campaign-dispatch';
import { dispatchConfiguredZohoBlogCampaign } from '@/lib/zoho-blog-campaign-server';
import { zohoReviewCampaignRouteParamsSchema } from '@/schemas/zoho-review-campaign-route-params';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const REVIEW_CAMPAIGN_POST_SELECT =
  'id, title, slug, excerpt, category, merchant_id, status, published_at' as const;

function getDispatchStatusCode(
  status: Awaited<ReturnType<typeof dispatchZohoBlogCampaign>>['status']
) {
  if (status === 'failed') return 502;
  if (status === 'skipped') return 422;
  return 200;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const parsedParams = zohoReviewCampaignRouteParamsSchema.safeParse(
      await params
    );
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsedParams.error.flatten() },
        { status: 400 }
      );
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'marketing', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { data: post, error } = await auth.supabase
      .from('blog_posts')
      .select(REVIEW_CAMPAIGN_POST_SELECT)
      .eq('id', parsedParams.data.id)
      .eq('merchant_id', access.merchantId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load blog post for Zoho review campaign', {
        error: error.message,
        merchantId: access.merchantId,
        postId: parsedParams.data.id,
      });
      return NextResponse.json(
        { error: 'Failed to load blog post' },
        { status: 500 }
      );
    }

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.status !== 'published' || !post.published_at) {
      return NextResponse.json(
        { error: 'Post must be published before sending a review campaign' },
        { status: 409 }
      );
    }

    const context = await getMerchantBlogRevalidationContext(
      auth.supabase,
      access.merchantId
    );
    const result = await dispatchConfiguredZohoBlogCampaign({
      audience: 'review',
      context,
      post,
      supabase: auth.supabase,
    });

    return NextResponse.json(
      { zohoCampaign: result },
      { status: getDispatchStatusCode(result.status) }
    );
  } catch (error) {
    console.error('Zoho review campaign POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
